# Backup- und Export-Strategie – 2026-04-07

## Zielbild

Die Plattform trennt künftig strikt zwischen drei Arten von Datenausgabe:

1. **Operativer Export**
   Export für laufende Vereinsarbeit innerhalb eines konkreten Moduls.
2. **Admin-Export**
   Administrativer Export für Prüf-, Korrektur- und Leitungsaufgaben mit rollenabhängiger Datenfreigabe.
3. **Backup**
   Technische Sicherung zur Wiederherstellung, nicht zur alltäglichen UI-Nutzung.

Die Leitregeln sind:

- **Export ist nicht gleich Backup.**
- **Operative Exporte sind domänenspezifisch, minimiert und zweckgebunden.**
- **Admin-Exporte sind stärker, aber rollen- und datenklassenabhängig begrenzt.**
- **Ein UI-Full-Backup per `select('*')` ist unzulässig, außer über explizit freigegebene Admin-Backup-Funktionen.**

---

## 1. Begriffsabgrenzung

## 1.1 Operativer Export

Zweck:

- Daten mit konkretem Arbeitsbezug herunterladen
- z. B. Spielplan, Rangliste, veröffentlichte Mitteilungen, Kommunikationslisten

Eigenschaften:

- begrenzter Scope
- zweckgebundene Feldmenge
- in der Regel benutzerfreundlich formatiert
- CSV, PDF oder JSON je Modul

Nicht erlaubt:

- rohe Tabellenexports mit sensiblen Zusatzspalten
- pauschales `select('*')`

## 1.2 Admin-Export

Zweck:

- Verwaltungs- und Kontrollaufgaben
- z. B. Mitgliederübersicht mit Statusfeldern, Löschanfragen, Team-/Match-Listen für Prüfzwecke

Eigenschaften:

- nur für privilegierte Rollen
- datenklassifiziert
- Feldauswahl abhängig von Rolle und Exportzweck
- stärker auditpflichtig als operative Exporte

## 1.3 Backup

Zweck:

- technische Wiederherstellung
- Notfall- und Migrationsszenarien

Eigenschaften:

- kein normaler Anwenderexport
- maschinenlesbar und vollständig oder zumindest restore-fähig
- JSON bevorzugt für strukturierte Sicherung
- UI nur für explizit freigegebene Admin-Backup-Jobs, nicht als rohe Tabellenliste mit Vollzugriff

Nicht erlaubt:

- Full-Backup aus beliebigen UI-Tabellenaktionen
- spontane Tabellenwahl ohne Whitelist und Rollenprüfung

---

## 2. Datenklassifizierung

## 2.1 Klassen

Empfohlene Export-Klassen:

- `public`
  Öffentlich oder intern unkritisch veröffentlichbar
- `internal`
  Vereinsintern, aber nicht besonders sensitiv
- `restricted`
  Personenbezogen oder organisatorisch sensibel
- `confidential`
  Hochsensitiv, nur eng begrenzt exportierbar

## 2.2 Klassifizierung je Datentyp

### `public`

- veröffentlichte News
- öffentliche Spielpläne ohne geheime Zusatzdaten
- öffentliche Teambezeichnungen

### `internal`

- interne Teamlisten ohne private Kontaktdaten
- Trainings- oder Belegungsübersichten ohne private Zusatzinfos
- operative Exportzusammenfassungen

### `restricted`

- Mitgliederlisten mit E-Mail, Telefonnummer, Geburtsdatum, Mitgliedsnummer
- Löschanfragen
- Kommunikationslisten
- Trainingsbuchungen mit Personenbezug

### `confidential`

- PIN/Code-Felder
- Datenschutz-/Consent-Auditdaten
- vollständige technische Backup-Inhalte mit personen- und sicherheitsrelevanten Zusatzspalten
- Export-Metadaten mit Zugriffskontext, IP oder User-Agent

## 2.3 Rollenauswirkung

- `mitglied` und `spieler` erhalten nur `public` und ausgewählte `internal` Exporte.
- `trainer` erhält zusätzliche operative Exporte innerhalb seines Aufgabenbereichs, aber keine pauschalen Mitglieder- oder Backup-Exports.
- `vorstand` darf freigegebene `restricted` Admin-Exporte erhalten.
- `admin` darf freigegebene `restricted` und ausgewählte `confidential` Exporte erhalten.
- `confidential` wird nie allein über UI-Sichtbarkeit freigegeben, sondern nur über explizite Service-Policy.

---

## 3. Export-Matrix je Modul

## 3.1 Mitglieder

### Operativer Export

- **CSV**
  Ranglisten, aktive Mitglieder ohne private Kontaktfelder, Team-/Altersklassen-Sichten
- **PDF**
  Ranglisten, Mitgliederübersicht für Sitzungen oder Aushänge in minimierter Form
- **JSON**
  nur für technische Integrationen, nicht als Standard-UI-Export

### Admin-Export

- **CSV**
  Mitgliederverwaltung mit Status, Eintritt/Austritt, Mitgliedsnummer, optional Kontaktfeldern je Rolle
- **PDF**
  Prüf- und Vorstandsansichten in minimierter Tabellenform
- **JSON**
  strukturierte Export-Jobs für Migration oder Review

### Backup

- **JSON**
  restore-fähige Members-Sicherung inklusive Relationen nur über explizite Admin-Backup-Funktion

### PII-Regeln

- `email`, `phone`, `street`, `zip_code`, `city`, `date_of_birth` nur für `admin` und freigegebene `vorstand`-Exports
- `member_number` für `vorstand` nur, wenn Exportzweck administrativ begründet ist

## 3.2 Mannschaften

### Operativer Export

- **CSV**
  Teamübersichten, Kaderlisten ohne private Zusatzdaten
- **PDF**
  Mannschaftsblätter, Kaderübersichten
- **JSON**
  optional für Integrationen oder strukturierte Sync-Szenarien

### Admin-Export

- **CSV**
  Teams mit Saisonphase, Aktivstatus, Captain, Kadergröße
- **PDF**
  Vorstands-/Admin-Übersichten
- **JSON**
  strukturierte Verwaltungs- und Prüfexporte

### Backup

- **JSON**
  Teams und Teamzuordnungen als restore-fähiger Verbund

## 3.3 Spielplan

### Operativer Export

- **CSV**
  Spielplan, Ergebnislisten, vereinfachte PIN-freie Arbeitslisten
- **PDF**
  Spieltagsübersichten, Heimspielpläne, Aushangformate
- **JSON**
  Integrations- oder Import-/Sync-nahe Exporte

### Admin-Export

- **CSV**
  Match-Statuslisten, Verschiebungen, Venue-Prüfungen, operative Korrekturlisten
- **PDF**
  Vorstandsübersicht ohne sensitive Match-Geheimnisse
- **JSON**
  strukturierte Export-Jobs inklusive Status-/Qualitätsflags

### Backup

- **JSON**
  schedule_matches inkl. relevanter Relationen nur über Backup-Service

### Sensitive Felder

- `pin` und `code` sind niemals Teil eines Standard-CSV/PDF-Exports für operative Nutzer.
- Export von `pin`/`code` ist nur als expliziter Admin-Export mit `confidential`-Freigabe erlaubt.

## 3.4 Kommunikation / News / Dokumente

### Operativer Export

- **CSV**
  veröffentlichte News, Listenübersichten
- **PDF**
  veröffentlichte Mitteilungen, Sitzungsunterlagen je Berechtigung
- **JSON**
  veröffentlichte News-Feeds oder strukturierte Dokumentlisten

### Admin-Export

- **CSV**
  Status, Publikationszustand, interne Kategorien
- **PDF**
  Vorstandsreports
- **JSON**
  Archiv-/Migrationsnahe Exporte

### Backup

- **JSON**
  restore-fähige News-/Dokument-Metadaten, Datei-Referenzen separat behandeln

## 3.5 Training

### Operativer Export

- **CSV**
  Belegungslisten, Trainingsslots, aggregierte Buchungen
- **PDF**
  Hallen- oder Trainingsübersichten
- **JSON**
  nur für technische Integrationen

### Admin-Export

- **CSV**
  personenbezogene Buchungslisten nur rollengeprüft
- **PDF**
  minimierte Aufsichts-/Prüfberichte
- **JSON**
  strukturierte Review-Exporte

### Backup

- **JSON**
  restore-fähige Buchungs- und Slot-Sicherung

## 3.6 Datenschutz / Löschanfragen

### Operativer Export

- keiner als Standardfunktion

### Admin-Export

- **CSV**
  Löschanfragen mit Status, Zeitpunkten, minimalem Mitgliedskontext
- **PDF**
  Review-Unterlagen in minimierter Form
- **JSON**
  Workflow- und Prüfdaten für technische Weiterverarbeitung

### Backup

- **JSON**
  vollständige restore-fähige Workflow-Sicherung

### Sensitive Felder

- Reason, Decision Notes, Audit-Kontext und Datenschutz-Historie sind `restricted` bis `confidential`

---

## 4. Service-Schnittstellen

## 4.1 Zielstruktur

```text
src/
  services/
    export/
      export.types.ts
      export.policy.ts
      export-job.service.ts
      export-audit.service.ts
      members-export.service.ts
      teams-export.service.ts
      schedule-export.service.ts
      communication-export.service.ts
      training-export.service.ts
      privacy-export.service.ts
      backup.service.ts
```

## 4.2 Zentrale Typen

Empfohlene Kernverträge:

```ts
type ExportKind = 'operational' | 'admin' | 'backup';
type ExportFormat = 'csv' | 'pdf' | 'json';
type DataClassification = 'public' | 'internal' | 'restricted' | 'confidential';

interface ExportRequest<TFilter = Record<string, unknown>> {
  module: string;
  kind: ExportKind;
  format: ExportFormat;
  filter?: TFilter;
  includeFields?: string[];
  reason?: string;
  dryRun?: boolean;
}

interface ExportJobMeta {
  id: string;
  module: string;
  kind: ExportKind;
  format: ExportFormat;
  classification: DataClassification;
  actorUserId: string;
  actorRole: string;
  startedAt: string;
  completedAt?: string;
  rowCount?: number;
  fieldSet: string[];
  redactions: string[];
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
}
```

## 4.3 Modulbezogene Services

Jeder Modul-Service sollte mindestens bereitstellen:

- `previewExport(request)`
- `runExport(request)`
- `listAllowedExports(context)`

Beispiel Mitglieder:

```ts
interface MembersExportService {
  previewExport(request: ExportRequest<MemberExportFilter>): Promise<ApiResult<ExportPreview>>;
  runExport(request: ExportRequest<MemberExportFilter>): Promise<ApiResult<PreparedExport>>;
}
```

`previewExport` liefert:

- welche Felder exportiert würden
- wie viele Zeilen betroffen sind
- welche Felder redigiert werden
- welche Datenklassifikation gilt

## 4.4 Backup-Service

Backup ist ein eigener Service, kein Spezialfall des normalen Export-Service.

Empfohlene Schnittstellen:

- `listBackupScopes()`
- `createBackupJob(request)`
- `downloadBackup(jobId)`
- `listBackupJobs(query)`

Ein Backup-Request braucht explizite Scope-Auswahl:

- `members-core`
- `teams-and-roster`
- `schedule-core`
- `communication-core`
- `privacy-workflows`

Kein freier Tabellenname aus der UI.

## 4.5 Export-Job-Service

Export-Jobs sollen auch bei synchronem Download vorbereitet werden.

Pflicht-Metadaten:

- Modul
- Export-Art
- Format
- Datenklassifikation
- Actor
- Filter-Fingerprint
- Feldauswahl
- Row-Count
- Redactions
- Ergebnisdatei oder Blob-Referenz

---

## 5. Sicherheitsregeln

## 5.1 Keine freien Tabellenexports

Folgende Muster sind unzulässig:

- `from(tableName).select('*')` aus UI-Komponenten
- Tabellenwahl per freiem String aus der Oberfläche
- Full-Backup per Klick ohne Scope-, Rollen- und Audit-Prüfung

Stattdessen:

- Whitelist-basierte Modul-/Scope-Definitionen
- explizite Feld-Allowlist
- Service-seitige Policy-Entscheidung

## 5.2 Rollenprüfung vor Format und Feldwahl

Die Policy entscheidet in dieser Reihenfolge:

1. Darf die Rolle das Modul exportieren?
2. Darf die Rolle die Export-Art (`operational`, `admin`, `backup`) nutzen?
3. Darf die Rolle die gewünschte Datenklasse erhalten?
4. Welche Felder müssen redigiert werden?
5. Darf das gewünschte Format verwendet werden?

## 5.3 Feld-Redaktion statt harter Fehlersituation, wo sinnvoll

Wenn ein Export grundsätzlich erlaubt ist, aber einzelne Felder zu sensitiv sind:

- Export darf laufen
- nicht erlaubte Felder werden entfernt oder maskiert
- Job-Metadaten dokumentieren die Redaktion

Beispiele:

- `email` nur für `admin`, für `vorstand` optional je Exporttyp
- `pin`/`code` außerhalb spezieller Admin-Exporte immer maskieren oder komplett entfernen

## 5.4 Backup nur mit expliziter Admin-Berechtigung

Empfehlung:

- Backup-Funktionen nur über `admin:all` oder eine neue dedizierte Berechtigung wie `backup:run`
- `vorstand` darf Standard-Admin-Exporte erhalten, aber nicht automatisch Full-Backups

## 5.5 Audit-Pflicht

Audit ist verpflichtend für:

- jeden Admin-Export mit `restricted` oder `confidential`
- jeden Backup-Job
- jeden Export mit personenbezogenen Daten
- jeden Export von `pin`/`code`

Audit-Mindestdaten:

- `action`
- `module`
- `kind`
- `format`
- `classification`
- `actorUserId`
- `actorRole`
- `rowCount`
- `fieldSet`
- `redactions`
- `reason`
- `jobId`

## 5.6 PDF- und CSV-Sicherheitsregeln

- PDF nur für lesefokussierte, kuratierte Exporte
- CSV nie mit ungeprüften Rohspalten
- JSON nur service-generiert und schema-stabil, nicht 1:1 Tabellenabbild aus UI

## 5.7 Datenminimierung

Jeder Export muss einen dokumentierten Zweck haben.

Regel:

- Standardmäßig minimale Feldmenge
- Erweiterte Felder nur per expliziter Admin- oder Backup-Freigabe

---

## 6. Export-Jobs mit Metadaten und Audit

## 6.1 Export-Job-Modell

Jeder Export erzeugt intern ein Job-Objekt, auch wenn die Datei sofort heruntergeladen wird.

Pflichtfelder:

- `jobId`
- `module`
- `kind`
- `format`
- `classification`
- `requestedBy`
- `requestedAt`
- `completedAt`
- `status`
- `filterFingerprint`
- `selectedFields`
- `redactedFields`
- `rowCount`
- `fileName`
- `auditLogged`

## 6.2 Audit-Anbindung

Bestehendes Audit sollte erweitert werden um mindestens:

- `export.operational.run`
- `export.admin.run`
- `export.backup.run`
- `export.backup.download`
- `export.admin.pin_code.run`

## 6.3 Job-Statusmodell

- `queued`
- `running`
- `completed`
- `failed`
- `cancelled`

Damit lassen sich spätere asynchrone Exporte, große Backups und Retry-Flows sauber ergänzen.

---

## 7. Risiken

## 7.1 Sicherheitsrisiken

- UI-Tabellenexporte mit `select('*')` umgehen Feldklassifizierung.
- Backup und Export werden vermischt, wodurch sensitive Daten zu leicht heruntergeladen werden.
- Rollenmodell und Exportmodell können auseinanderlaufen, wenn Policies nur in der UI liegen.
- `pin`/`code` oder Löschanfragen könnten versehentlich in Standardexporten landen.

## 7.2 Datenschutzrisiken

- personenbezogene Daten werden ohne Zweckbindung exportiert
- CSV-Dateien werden lokal weiterverteilt und verlieren Zugriffskontrolle
- Admin-Export ohne ausreichendes Audit ist später nicht nachvollziehbar

## 7.3 Technische Risiken

- große Tabellenexports ohne Paging oder Job-Modell führen zu Speicher- und Browserproblemen
- CSV als einziges Format reicht für restore-fähige Backups nicht aus
- fehlende Schemastabilität in JSON-Exporten erschwert Reimport und Wiederherstellung

## 7.4 Organisationsrisiken

- Nutzer verstehen „Backup“ als Allzweck-Download und verwenden es operativ falsch
- Vorstand und Admin erhalten uneinheitliche Sicht auf sensible Daten
- fehlende Whitelist erzeugt Wildwuchs bei neuen Exporten pro Modul

---

## 8. Konkrete Empfehlungen

1. Das bestehende Backup-UI als echte Backup-Verwaltung neu definieren und den aktuellen freien Tabellenexport entfernen.
2. Operative Exporte, Admin-Exporte und Backups in getrennten Services modellieren.
3. `ExportFormat` um `json` als Erstklass-Format ergänzen; `xlsx` optional später wieder ergänzen.
4. Für jedes Modul eine Export-Allowlist mit Format-, Feld- und Rollenmatrix pflegen.
5. Vor jedem Export zuerst `previewExport()` ausführen und der UI Klassifikation, Row-Count und Redaktionen zurückgeben.
6. Full-Backup aus UI nur mit expliziter Admin-Berechtigung und über vordefinierte Backup-Scopes erlauben.

## 9. Beziehung zum Ist-Zustand

Diese Strategie reagiert direkt auf den aktuellen Zustand:

- Es existieren bereits Export-Builder und ein CSV-Adapter in `src/lib/export/*`.
- Das aktuelle Backup in `src/components/settings/SettingsBackup.tsx` und `src/pages/Admin.tsx` ist fachlich kein Backup, sondern freier Tabellenexport.
- Die bestehende Rollen- und Settings-Berechtigung (`backup: admin:all`) ist ein guter Start, reicht aber ohne Feldklassifizierung, Scope-Whitelist und Export-Job-Audit nicht aus.
