# Kommunikations-Domain (Zielbild) – 2026-04-07

## Zielsetzung

Die Kommunikations-Domain bündelt News, Dokumente, Listen und Export-Sichten in einem konsistenten Modell mit klaren Sicherheitsgrenzen:

- **newsService** unterstützt Entwurf, Veröffentlichung und Archivierung.
- **Dokumente** und **Kommunikationslisten** sind als getrennte Content-Typen modelliert.
- **QTTR/TTR-Rangliste** wird als exportfähige Datenansicht bereitgestellt.
- **Interne und öffentliche Inhalte** werden strikt getrennt (fachlich + RLS).
- News sind **nach Sichtbarkeit, Veröffentlichungsstatus und Rolle** filterbar.

Ergänzende Zielbilder:

- `docs/architecture/mapping-target-architecture-2026-04-07.md`
- `docs/architecture/ui-label-standardization-2026-04-07.md`
- `docs/security/rls_target_architecture_2026-04-07.md`

---

## 1) Datenmodell

## 1.1 Aggregate und Tabellen

### A) News (`news_articles`)

Fachlich führender Content-Typ für redaktionelle Inhalte.

- `id: uuid`
- `title: text`
- `slug: text unique`
- `content: text`
- `excerpt: text | null`
- `status: 'draft' | 'published' | 'archived'`
- `visibility: 'public' | 'internal'`
- `published_at: timestamptz | null`
- `author_id: uuid | null`
- `category: text | null`
- `tags: text[]`
- `pinned: boolean`
- `image_url: text | null`
- `created_at: timestamptz`
- `updated_at: timestamptz`

**Invarianten:**

- `published_at` ist nur für `status = 'published'` gesetzt.
- `archived` ist terminal für Public-Feeds (nur über explizite Admin/Autor-Filter sichtbar).
- `slug` bleibt stabil für öffentliche URLs.

### B) Dokumente (`documents`)

Separater Content-Typ für Dateien und statische Inhalte.

- `id, title, description, file_url, category, uploaded_by, created_at, updated_at`
- Erweiterung fachlich: `visibility: 'public' | 'internal'` (statt impliziter Kategorie-Konvention).

### C) Kommunikationslisten (`communication_lists`, `communication_list_members`)

Separater Content-Typ für Verteilerlogik.

- `communication_lists`: `id, name, description, list_type, created_by, created_at, updated_at`
- `communication_list_members`: `list_id, member_id, created_at`
- Fachliche Ergänzung: `audience_scope` (`public`/`internal`) statt Ableitung nur aus `list_type`.

### D) Export-View Rangliste (`vw_rating_export` / Service-Projection)

Read-optimierte Sicht für QTTR/TTR.

- `member_id`
- `first_name`, `last_name`, `display_name`
- `qttr_rating`, `ttr_rating`
- `rank_qttr` (dense rank)
- `is_active`
- optional: `team_label`, `season_id`

**Export-Metadaten:**

- `generated_at`
- `generated_by`
- `audience` (`public`/`internal`)
- `format` (`json`/`csv`)

---

## 2) Service-API

## 2.1 `newsService`

### Befehle (Write)

- `createDraft(input)`
- `updateDraft(id, patch)`
- `publish(id, { publishAt? })`
- `archive(id, { reason? })`
- `restoreToDraft(id)`
- `delete(id)` (nur für berechtigte Rollen)

### Abfragen (Read)

- `list(filter)` mit:
  - `status[]` (`draft|published|archived`)
  - `visibility[]` (`public|internal`)
  - `roleContext` (`guest|member|editor|board|admin`)
  - `authorId?`
  - `search?` (Titel/Inhalt/Tags)
  - `category?`
  - `tag?`
  - `pinnedFirst?`
  - `limit/offset` oder Cursor
- `getById(id, roleContext)`
- `getBySlug(slug, roleContext)`

## 2.2 `documentService`

- `list({ visibility, category, search, limit, offset })`
- `getById(id)`
- `create/update/remove`
- `listCategories()`

## 2.3 `communicationListService`

- `list({ audienceScope })`
- `getById(id)`
- `getMembers(listId)`
- `addMember/removeMember/setMembers`
- `listWithCounts()`

## 2.4 `communicationExportService`

- `buildRatingExport({ audience, generatedBy, seasonId? })`
- `buildRatingCsv(meta)`
- optional: `buildRatingSnapshot(meta)` zum revisionssicheren Archivieren

---

## 3) Sichtbarkeitsregeln

## 3.1 Prinzipien

1. **Deny by default** (ohne passende Rolle kein Zugriff).
2. **RLS als Primärschutz**, Service-Filter als zweite Schicht.
3. **Keine Vermischung** interner und öffentlicher Inhalte in derselben Query ohne expliziten Scope.

## 3.2 Regelmatrix News

- **Guest (nicht eingeloggt):** nur `published + public`.
- **Member:** `published + public/internal`.
- **Editor/Board/Admin:** zusätzlich `draft` und `archived` gemäß Rolle.
- **Author:** darf eigene Drafts/Archive sehen, auch ohne globale Redaktionsrolle.

## 3.3 Regelmatrix Dokumente/Listen

- **Public Scope:** nur `visibility = public` bzw. `audience_scope = public`.
- **Internal Scope:** nur authentifizierte Rollen mit Freigabe.
- **Admin/Board:** Vollzugriff inkl. Pflegeoperationen.

---

## 4) Query-Strategie

## 4.1 Lesepfade

- **Public Feed Query (hot path):**
  - Filter: `status = published`, `visibility = public`
  - Sortierung: `pinned DESC, published_at DESC`
  - Indexe: `(status, visibility, published_at DESC)`, partiell für `pinned=true`
- **Internal Feed Query:**
  - Filter: `status = published`, `visibility IN ('public','internal')`
  - Sicherheitsprüfung über Session/Rolle
- **Editorial Query:**
  - flexible Mehrfachfilter (`status[]`, `visibility[]`, `author_id`)
  - Cursor/Pagination für Backoffice-Listen

## 4.2 Suchstrategie

- Primär `ILIKE` auf `title`, `excerpt`.
- Optional Full-Text (`tsvector`) für größere Datenmengen.
- Tags/Kategorie als strukturierte Filter vor Freitext anwenden.

## 4.3 Exportstrategie QTTR/TTR

- Query auf read-optimierter Sicht (`is_active=true`).
- Deterministische Sortierung:
  1. `qttr_rating DESC NULLS LAST`
  2. `ttr_rating DESC NULLS LAST`
  3. `last_name ASC, first_name ASC`
- Ranking serverseitig berechnen (dense rank).
- Export in JSON + CSV mit identischer Zeilenreihenfolge.

## 4.4 Caching & Query Keys

- getrennte Keys nach Domäne und Scope:
  - `communication.news.list({ status, visibility, roleContext, ... })`
  - `communication.documents.list({ visibility, ... })`
  - `communication.lists.list({ audienceScope })`
  - `communication.exports.ratings({ audience, seasonId })`
- Kürzere TTL für interne/redaktionelle Daten als für Public Feeds.

---

## 5) Edge Cases

1. **Publish-Race-Condition:** zwei gleichzeitige Publish-Aktionen → optimistisches Locking (`updated_at` check).
2. **Archiviertes Item mit altem `published_at`:** beim Wechsel zu `archived` `published_at` konsistent behandeln (nullen oder Historie definieren).
3. **Role Downgrade während Session:** Tokens neu validieren; Zugriff auf interne Inhalte sofort entziehen.
4. **Visibility-Wechsel public → internal:** CDN/Frontend-Caches aktiv invalidieren.
5. **Slug-Kollision bei Restore/Clone:** automatisches Suffixing (`-2`, `-3`) mit Unique-Constraint als letzte Instanz.
6. **Leere QTTR/TTR-Werte:** stabile Ranglistenlogik mit `NULLS LAST`; ggf. Kennzeichnung „ohne Wert“.
7. **Export bei parallel laufendem Import:** Snapshot-Transaktion oder `as of`-Zeitpunkt verwenden.
8. **Gemischte Filter ohne Rolle:** wenn `visibility=internal` angefragt wird, aber Rolle fehlt → `403` statt leerer Liste (bewusste Sicherheitssemantik).
9. **Autor gelöscht/deaktiviert:** News bleibt erhalten, `author_id` optional (`SET NULL`) + Fallback-Anzeige „Unbekannt“.
10. **Bulk-Änderungen Listenmitglieder:** atomar via RPC/Transaktion statt Delete+Insert ohne Rollback.

---

## 6) Umsetzungshinweise (inkrementell)

1. `newsService` von `is_published` auf `status/visibility` heben.
2. `documents` und `communication_lists` um explizite Sichtbarkeitsspalten ergänzen.
3. RLS-Policies entlang der Regelmatrix vereinheitlichen.
4. Query Keys auf kombinierte Filter (`status`, `visibility`, `roleContext`) standardisieren.
5. Export über dedizierte View stabilisieren und Snapshot-Option ergänzen.

Damit ist die Kommunikations-Domain fachlich klar getrennt, sicher filterbar und für redaktionelle sowie exportorientierte Workflows vorbereitet.
