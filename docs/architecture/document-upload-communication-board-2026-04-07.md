# Dokumenten- und Upload-Logik für Kommunikation & Vorstand (2026-04-07)

## 1) Datenmodell

### 1.1 Ziel: generisches Dokumentmodell

Ein einziges fachliches Modell `documents` deckt alle Fälle ab:

- `owner_context = 'communication'` → Kommunikationsdokumente intern
- `owner_context = 'board_meeting'` → Dateien zu einer Vorstandssitzung (`owner_id = meeting_id`)
- `owner_context = 'board_general'` → allgemeine Vorstandsunterlagen ohne Sitzung
- `owner_context = 'public'` → öffentliche Vereinsdokumente

### 1.2 Tabellenstruktur (fachlich)

**Metadaten (DB):**

- `id: uuid`
- `title: text`
- `description: text | null`
- `owner_context: 'communication' | 'board_meeting' | 'board_general' | 'public'`
- `owner_id: uuid | null` (Pflicht für `board_meeting`)
- `visibility: 'public' | 'internal'`
- `category: text | null` (fachliche Gruppierung, nicht mehr als Sicherheitsmerkmal)
- `file_url: text | null` (Legacy/Kompatibilität)
- `storage_bucket: text`
- `storage_path: text | null`
- `file_name: text | null`
- `mime_type: text | null`
- `file_size_bytes: bigint | null`
- `uploaded_by: uuid` (Legacy-Feld)
- `uploader_id: uuid` (kanonisch)
- `created_at: timestamptz`
- `updated_at: timestamptz`

### 1.3 Trennung der Schichten

1. **Dateispeicher**: `storage.objects` (binäre Datei, Pfad/Bucket).
2. **Metadaten**: `public.documents` (Kontext, Rechte, MIME, Größe, Uploader).
3. **UI-ViewModel**: frontendspezifische Projection mit Labels/Actions.

Beispiel-ViewModel:

```ts
interface DocumentListItemVM {
  id: string;
  title: string;
  context: 'communication' | 'board_meeting' | 'board_general' | 'public';
  contextLabel: string;
  visibility: 'public' | 'internal';
  fileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  uploadedByDisplay: string;
  createdAt: string;
  canDownload: boolean;
  canDelete: boolean;
}
```

---

## 2) Service-API

## 2.1 Storage-Port (Datei)

- `uploadBinary({ bucket, path, file, contentType }) -> { bucket, path }`
- `deleteBinary({ bucket, path })`
- `createSignedDownloadUrl({ bucket, path, expiresInSec })`

## 2.2 Metadata-Port (DB)

- `createDocument(meta)`
- `updateDocumentMeta(id, patch)`
- `getDocumentById(id)`
- `listDocuments(filter)`
- `deleteDocument(id)`

## 2.3 Domain-Service (Orchestrierung)

- `uploadDocument(input)`
  - validiert Kontext + Rolle + Dateityp + Dateigröße
  - lädt Binärdatei hoch
  - schreibt Metadaten
  - rollback: löscht Binärdatei bei DB-Fehler
- `listDocumentsForActor(actorRole, filter)`
  - erzwingt Kontext-/Visibility-Filter
- `deleteDocumentForActor(actorRole, id)`
  - prüft Policy, löscht Metadaten + Binärdatei
- `getDownloadLinkForActor(actorRole, id)`
  - kein `publicUrl` für interne Dateien; nur signierte URL

### 2.4 Filtervertrag

```ts
interface DocumentFilter {
  ownerContext?: 'communication' | 'board_meeting' | 'board_general' | 'public';
  ownerId?: string;
  visibility?: 'public' | 'internal';
  category?: string;
  search?: string;
  mimeTypePrefix?: string; // z. B. application/pdf
  limit?: number;
  offset?: number;
}
```

---

## 3) Sicherheitsregeln

## 3.1 Leitlinien

- **Deny by default**.
- **RLS ist primär**, Servicechecks sekundär.
- Zugriff niemals nur aus `category` ableiten.
- Interne Dateien nicht via `getPublicUrl` exponieren.

## 3.2 Kontext-/Rollenmatrix

- `public`: lesen alle Auth-User; schreiben `admin|vorstand`.
- `communication`:
  - read: `admin|vorstand|trainer`
  - write: `admin|vorstand`
  - delete: `admin|developer`
- `board_general` und `board_meeting`:
  - read: `admin|vorstand|developer`
  - write: `admin|vorstand`
  - delete: `admin|developer`

## 3.3 Datenintegrität

- CHECK: `owner_context` nur erlaubte Werte.
- CHECK: `visibility` nur `public|internal`.
- CHECK: `owner_context='board_meeting' -> owner_id IS NOT NULL`.
- CHECK: `file_size_bytes >= 0`.
- UNIQUE: `(storage_bucket, storage_path)` wenn `storage_path` gesetzt.

---

## 4) Migrationshinweise

1. `documents` um neue Spalten erweitern.
2. Backfill:
   - `owner_context='communication'` für Bestand.
   - `visibility` aus Altlogik (`category LIKE 'internal:%'`) ableiten.
   - `uploader_id=uploaded_by`.
3. `meeting_documents` in `documents` als `owner_context='board_meeting'` überführen.
4. RLS-Policies auf kontextbasierte Funktion umstellen (`can_access_document_context`).
5. API schrittweise umstellen:
   - zuerst Reads dualfähig (alt/neu),
   - dann Writes nur noch neu,
   - später `meeting_documents` deprecaten.

---

## 5) Edge Cases

1. **Upload erfolgreich, DB-Insert fehlgeschlagen** → Binärdatei sofort löschen (Rollback).
2. **DB-Insert erfolgreich, Storage-Löschung fehlschlägt bei Delete** → Soft-Delete markieren + Retry-Queue.
3. **MIME-Type Spoofing** → serverseitig MIME sniffer + Extension-Whitelist.
4. **Oversize-Upload** → vor Upload abbrechen; max Größe je Kontext konfigurierbar.
5. **Role Downgrade während Session** → Download-URL kurzlebig (z. B. 60–120s).
6. **Visibility-Wechsel internal → public** → neue URL erzeugen / Caches invalidieren.
7. **Dateiname mit Sonderzeichen** → storage_path sanitizen, Originalname separat speichern.
8. **Doppelte Uploads** → optional dedup über Hash + Größe + MIME.
9. **Fehlendes owner_id bei board_meeting** → harte DB-Constraint statt Service-only.
10. **Legacy `file_url` ohne `storage_path`** → kompatibel lesbar lassen, aber Writes nur noch über `storage_path`.
