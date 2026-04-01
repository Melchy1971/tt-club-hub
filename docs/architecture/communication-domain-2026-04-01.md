# Kommunikationslogik (Entwurf) – 2026-04-01

## Ziele

- **newsService mit Draft/Published:** Status-Filter wird über `status: 'draft' | 'published' | 'all'` abgebildet.
- **Dokumenten- und Listen-Basisstruktur:** einheitliche Filter mit `audience` und Pagination.
- **QTTR/TTR-Export vorbereiten:** dedizierter `communicationExportService` liefert strukturierte Exportdaten + CSV.
- **Interne vs öffentliche Inhalte trennen:** API-Ebene trennt über `audience` (`public`/`internal`) mit klaren Konventionen.
- **Query Keys und Caching standardisieren:** neue `communicationKeys` + `communicationCacheConfig`.

## Service-APIs

### News

- `newsService.list({ status, audience, search, limit, offset })`
- `newsService.listPublished(...)`
- `newsService.listDrafts(...)`
- `newsService.listPublic(...)`
- `newsService.listInternal(...)`

### Dokumente

- `documentService.list({ category, search, audience, limit, offset })`
- `DocumentUI.audience` wird aus Kategorie-Konvention abgeleitet:
  - `internal:*` → intern
  - sonst → öffentlich

### Kommunikationslisten

- `communicationListService.list({ audience })`
- `CommunicationListUI.audience` wird aus `list_type` abgeleitet:
  - `internal` → intern
  - sonst → öffentlich

### Export

- `communicationExportService.buildRatingExport(meta)` → strukturierte Daten (`rows` + `meta`)
- `communicationExportService.buildRatingCsv(meta)` → CSV-String

## Datenfluss

1. UI fragt über TanStack Query mit `communicationKeys` an.
2. Service kapselt Supabase Query + Filter + Mapping.
3. Rückgabe über `ApiResult` (success/error).
4. UI verarbeitet nur bereits normalisierte Service-Ergebnisse.

## Export-Architektur (QTTR/TTR)

- Exportquelle: `members` (`is_active = true`), sortiert nach `qttr_rating`.
- Exportmodell:
  - `meta`: Zeitpunkt, Ersteller, Audience
  - `rows`: Rang, Mitglied, Name, QTTR, TTR
- Ausgabeformen:
  - Objekt-Payload (für PDF/HTML-Renderer)
  - CSV (für Import in externe Tools)

## Sicherheitsgrenzen

- **Domänengrenze:** `audience` wird durch Service API erzwungen und nicht direkt in UI gemischt.
- **Interne Inhalte:**
  - News-Entwürfe gelten bis dedizierter DB-Spalte als intern.
  - Dokumente mit Kategoriepräfix `internal:` gelten als intern.
  - Listen mit `list_type = internal` gelten als intern.
- **Öffentliche Inhalte:** nur explizit gefilterte öffentliche Datensätze.
- **Hinweis:** RLS bleibt die primäre Security-Schicht; Service-Filter sind ein zusätzlicher Guardrail auf Anwendungsebene.
