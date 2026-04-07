# Technischer Abschlussreview (2026-04-01)

## Folgeartefakt
Die aus diesem Review abgeleitete Zielversion des anwendungsweiten Qualitätsrahmens liegt in:

- `docs/architecture/technical-quality-framework-2026-04-07.md`

## Methodik / Scope
- Statische Code-Analyse von Frontend- und Service-Schicht.
- Prüfung entlang der geforderten Achsen:
  - TypeScript Strict Mode
  - Service-Duplizierung
  - Query Keys
  - Listen-Performance
  - Fehlerbehandlung
  - Sicherheitsrisiken
  - Testlücken
- Hinweis: Tooling-Läufe (`eslint`, `npm install`) konnten in dieser Umgebung wegen Registry-Policy nicht vollständig ausgeführt werden.

## 1) Priorisierte Mängelliste

### P0 — Inkonsistente/unsichere Type-Safety trotz Strict-Konfiguration
1. **Widersprüchliche TS-Compiler-Konfiguration**: In der Root-Config sind `noImplicitAny=false` und `strictNullChecks=false` gesetzt, während in `tsconfig.app.json` parallel `strict=true` aktiv ist. Das erhöht die Gefahr, dass einzelne Dateien/Tools nicht dieselben Regeln erzwingen.  
   **Risiko:** schleichende `any`-/Nullability-Fehler in produktionsrelevantem Code.  
   **Beleg:** `tsconfig.json`.
2. **Häufige Umgehung von Typen mit `as any`** in sensiblen Datenflüssen (Privacy-Settings).  
   **Risiko:** Schema-Drift und Runtime-Fehler bleiben unentdeckt; API-Verträge werden ausgehöhlt.  
   **Beleg:** `SettingsPrivacy.tsx`.

### P1 — Service-Duplizierung / fehlende Architekturgrenze
3. **Direkte Supabase-Zugriffe in Seiten/Komponenten statt zentralen Services** (z. B. Board/Import/Substitutes). Es existieren zwar Services, sie werden aber nur teilweise genutzt.  
   **Risiko:** doppelte Query-Logik, inkonsistente Fehlerbehandlung, höhere Wartungskosten.  
   **Beleg:** `Board.tsx`, `Substitutes.tsx`, `Import.tsx`.

### P1 — Query-Key-Drift und Cache-Invalidation-Risiko
4. **Zentrale Query-Key-Factory vorhanden, aber in vielen Modulen nicht verwendet**; stattdessen ad-hoc String-Keys (`'board-news'`, `'news'`, `'schedule'`, `'substitute-requests'` usw.).  
   **Risiko:** fehlerhafte/zu breite/zu enge Invalidation und schwer nachvollziehbares Caching-Verhalten.  
   **Beleg:** `src/lib/queryKeys.ts` vs. Nutzung in `Board.tsx`, `Substitutes.tsx`, `Import.tsx`.

### P1 — Performance-Risiken bei Listen
5. **Clientseitige Vollmengen-Ladevorgänge ohne Pagination/Limit** (`select('*')`) in diversen Listenansichten.  
   **Risiko:** steigende Latenz, hoher Speicherverbrauch, unnötiger Netzwerktraffic bei wachsender Datenmenge.  
   **Beleg:** `Board.tsx` (News/Meetings), `Admin.tsx` (Backup-Export lädt gesamte Tabellen), `Substitutes.tsx`.
6. **Mehrfache Filter-/Map-Operationen pro Render** auf potenziell großen Arrays ohne Memoisierung.  
   **Risiko:** unnötige Re-Render-Kosten und UI-Ruckeln.

### P1 — Fehlerbehandlung zu generisch
7. **Mehrere `catch`-/`onError`-Zweige ohne Fehlermetadaten** (nur generische Toast-Meldungen).  
   **Risiko:** schlechte Diagnostik im Betrieb, hohe MTTR.  
   **Beleg:** `Board.tsx`, `Substitutes.tsx`, `Import.tsx`.

### P1 — Sicherheitsrisiken
8. **Dokumentierter RLS-Handlungsbedarf**: Das vorhandene Security-Review listet kritische Punkte (z. B. zu breite Leserechte, fehlende `WITH CHECK` in Policies).  
   **Risiko:** PII-Leakage und potenzielle Privilegienausweitung, wenn Härtungsmaßnahmen nicht vollständig umgesetzt sind.  
   **Beleg:** `docs/security/rls_permissions_review_2026-04-01.md`.
9. **Generischer Tabellenexport in Admin-Backup (`from(tableName as any).select('*')`)**.  
   **Risiko:** bei zu breiter UI-Freigabe/Fehlkonfiguration könnten sensible Tabellen exportiert werden.  
   **Beleg:** `Admin.tsx`.

### P2 — Testlücken
10. **Nahezu keine Fachtests**; vorhanden ist nur ein triviales Beispiel (`expect(true).toBe(true)`).  
    **Risiko:** Regressionsrisiko bei Refactorings (insb. Import-Parser, Query-Key-Migration, Berechtigungslogik).  
    **Beleg:** `src/test/example.test.ts`.

## 2) Konkrete Refactoring-Schritte

### A. TypeScript-Härtung (P0)
1. Root-TSConfig bereinigen:
   - `strict: true` zentral erzwingen (oder Root nur als Referenz-Container nutzen, ohne widersprechende Flags).
   - `strictNullChecks`, `noImplicitAny` nicht auf `false` setzen.
2. `as any` in Privacy- und Settings-Flows entfernen:
   - dedizierte DTO-Typen pro Tabelle (`member_consents`, `consent_audit_log`, `deletion_requests`).
   - kleine Mapper-Funktionen einführen, statt ad-hoc Casts.

### B. Service-Schicht konsolidieren (P1)
3. Für jede Domäne einen Service als **Single Source of Truth** durchziehen:
   - Board: `news`, `meetings`, `meeting_documents`, `communication_lists` komplett in Services.
   - Substitutes/Import: read/write Queries in `substituteService`/`scheduleService`/`memberService` bündeln.
4. Gemeinsame Patterns extrahieren:
   - `list`, `create`, `update`, `remove` inkl. standardisierter Fehler-Mapping-Funktion.

### C. Query-Key-Normalisierung (P1)
5. Migration auf `queryKeys.ts` (inkrementell, domänenweise):
   - zuerst `board`, `substitutes`, `import`.
   - harte Regel: keine Inline-String-Keys mehr in neuen/angepassten Modulen.
6. Invalidation-Helfer einführen (z. B. `invalidateBoardNews`, `invalidateScheduleLists`), um Tippfehler zu vermeiden.

### D. Listen-Performance (P1)
7. Serverseitig paginieren/limitieren:
   - `.range()`/Cursor-basiert für große Tabellen.
   - gezielte Spalten statt `select('*')`.
8. Abgeleitete Daten memoizen:
   - `useMemo` für `Map`-Aufbauten und gefilterte Teilmengen (`pendingRequests`, `matchesWithUnavailable`, etc.).
9. Für sehr große Tabellen Views/Denormalisierung prüfen (z. B. vorberechnete Counts statt clientseitiger Aggregation).

### E. Fehlerbehandlung/Observability (P1)
10. Einheitliches Error-Utility einführen:
   - Supabase-Fehler (`code`, `details`, `hint`) in nutzerfreundliche, aber differenzierte Messages mappen.
   - optional: zentrale Telemetrie-Hooks (Sentry o.ä.) für nicht-handhabbare Fehler.
11. `onError` nie ohne Error-Parameter; Logging mit Kontext (`feature`, `operation`, `entityId`).

### F. Sicherheit (P1)
12. Offene RLS-Punkte aus dem Security-Review priorisiert schließen:
   - restriktivere SELECT-Policies,
   - konsequentes `WITH CHECK`,
   - Trennung public/private Profile,
   - Rollentestmatrix als CI-Check.
13. Backup-Export härten:
   - Whitelist erlaubter Tabellen,
   - serverseitige Freigabelogik,
   - Audit-Log für Exporte.

## 3) Minimale Teststrategie (Lean, aber wirksam)

### Stufe 1 — Muss-Tests (sofort)
1. **Unit: Import-Parser**
   - Datums-/Zeit-Parsing, Ergebnis-Parsing, Team-Matching, Fehlerfälle.
2. **Unit: Query-Key-Factory**
   - stabile Key-Generierung (inkl. Parameterobjekte), Snapshot-/Equality-Tests.
3. **Unit: Error-Mapping**
   - Supabase-Fehlercode -> UI-Meldung.

### Stufe 2 — Integrations-Tests (kurzfristig)
4. **Service-Tests mit Mock-Supabase**
   - `list/create/update/delete` für `news`, `meetings`, `substitute_requests`.
5. **React-Query-Flows**
   - Mutation triggert korrekte Invalidation (nur betroffene Keys).

### Stufe 3 — Security-/Regression-Gates (mittelfristig)
6. **RLS-Testmatrix automatisieren** (SQL-Testskripte in CI):
   - self-read erlaubt, cross-read verboten, spoofing blockiert.
7. **Smoke-E2E** (Playwright):
   - 1 Kernflow je Domäne (Board News, Schedule Import, Substitutes).

## Kurzfazit
Die gravierendsten Risiken liegen in der Kombination aus **inkonsistenter Typstrenge**, **fragmentierter Datenzugriffsschicht** und **uneinheitlichen Query Keys**. Eine fokussierte Stabilisierung dieser drei Bereiche reduziert gleichzeitig Fehlerquote, Performance-Probleme und Sicherheitsfolgen.
