# Technischer Qualitätsrahmen (2026-04-07)

## Zielbild
Dieser Qualitätsrahmen definiert das verbindliche technische Mindestniveau für die gesamte Anwendung. Er baut auf dem Abschlussreview vom 2026-04-01 und dem ersten Qualitätsrahmen vom 2026-04-02 auf, schließt aber die inzwischen sichtbaren Architektur- und Tooling-Lücken konkreter:

- eine konsistente TypeScript- und ESLint-Härtung ohne widersprüchliche Compilerregeln,
- eine harte Service-Grenze zwischen UI, Supabase und Domänenlogik,
- eine einheitliche Fehler- und Recovery-Strategie pro Routencluster,
- minimale, aber produktionsrelevante Testabdeckung für Berechtigungen, Services, Parser und Migrationsnähe,
- Merge-Gates, die Qualitätsverschlechterung aktiv blockieren.

---

## 1) Qualitätscheckliste

### A. TypeScript- und Build-Härtung
- [ ] Root-TSConfig bereinigen: keine widersprüchlichen Flags wie `noImplicitAny: false` und `strictNullChecks: false` in `tsconfig.json`, solange `tsconfig.app.json` parallel `strict: true` erzwingt.
- [ ] Aktive App-Targets auf dieselbe Strictness ausrichten: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`, `noImplicitOverride`.
- [ ] `allowJs` nur behalten, wenn tatsächlich JS-Migrationen laufen; sonst deaktivieren.
- [ ] `noUnusedLocals` und `noUnusedParameters` mindestens für neue oder migrierte Module aktivieren.
- [ ] Separaten Typecheck-Gate ergänzen: `tsc --noEmit -p tsconfig.app.json`.
- [ ] Keine neuen `as any`, `ts-ignore` oder blinden Non-Null-Assertions ohne dokumentierte Ausnahme mit Abbaupfad.
- [ ] Externe Datenflüsse nur über definierte DTO-, Schema- und Domain-Mapping-Schichten führen.

### B. ESLint als Quality Gate
- [ ] ESLint von reiner Recommended-Basis auf projektweite Fehlerregeln anheben.
- [ ] `@typescript-eslint/no-unused-vars` aktivieren, mit `_`-Konvention für bewusst ungenutzte Argumente.
- [ ] `@typescript-eslint/no-explicit-any` mindestens als `warn`, Zielzustand `error`.
- [ ] `@typescript-eslint/no-floating-promises` aktivieren.
- [ ] `@typescript-eslint/consistent-type-imports` aktivieren.
- [ ] `@typescript-eslint/switch-exhaustiveness-check` aktivieren.
- [ ] Architekturregeln ergänzen: keine direkten `supabase.from(...)`-Zugriffe in Pages und Settings-Komponenten, keine neuen Inline-Query-Keys in React Query.
- [ ] Lint-Ausnahmen nur lokal und begründet, nicht als globale Abschwächung.

### C. Fehler- und Recovery-Qualität
- [ ] Zentrales Fehlermodul mit Klassen oder Discriminated Union einführen: `ValidationError`, `PermissionError`, `DomainError`, `InfrastructureError`, `UnknownError`.
- [ ] Gemeinsames Error-Mapping von Supabase-, Netzwerk-, Parser- und Berechtigungsfehlern auf UX-Meldung und Log-Kontext.
- [ ] Jeder schreibende Servicepfad liefert maschinenlesbare Fehlerkategorien statt nur generische Toast-Texte.
- [ ] `catch`-Blöcke ohne Fehlerobjekt oder ohne Kontext-Logging sind nicht zulässig.
- [ ] Async-Fehler in Queries/Mutations dürfen nicht implizit verschwinden; jede Mutation braucht einen definierten Fehlerpfad.

### D. ErrorBoundary-Strategie
- [ ] Root-ErrorBoundary um `AppLayout` und Routen-Rendering einführen.
- [ ] Routencluster mit eigenen Boundaries absichern:
  - öffentlicher Zugriff: `login`, `reset-password`
  - Kernbetrieb: `dashboard`, `members`, `teams`, `matches`, `schedule`, `team schedule`
  - operative Domänen mit hohem Schreibanteil: `substitutes`, `training`, `communication`, `board`, `admin`, `import`, `settings`, `roles`, `seasons`
- [ ] Boundary-Fallbacks müssen Recovery erlauben: neu laden, zurück zur Startseite, optional Sitzungszustand neu aufbauen.
- [ ] Render-Fehler über Boundary behandeln, Async-Fehler weiterhin über Query-/Mutation-State und zentrales Error-Mapping.
- [ ] Fehlerkontext mindestens mitgeben: `feature`, `operation`, `route`, `userRole`, optional `entityId`.

### E. Service- und Datenzugriffsqualität
- [ ] `src/services` ist Single Source of Truth für Datenzugriffe; UI liest und schreibt nicht direkt gegen Supabase.
- [ ] Jede Domäne verwendet klar getrennte Ebenen: `DbRow`, `DTO`, `DomainModel`, `ViewModel`.
- [ ] Service-Rückgaben bleiben standardisiert (`ApiResult` oder äquivalentes Ergebnisobjekt) statt gemischter Error-/Toast-Muster.
- [ ] Query-Key-Factory aus `src/lib/queryKeys.ts` wird verpflichtend; neue Inline-String-Keys sind Qualitätsverletzungen.
- [ ] Invalidation nur domänenspezifisch und gezielt, keine pauschale Cache-Räumung.
- [ ] Große Listen nicht mehr als Vollmenge mit `select('*')`, sondern mit Projektion, Limit und klarer Sortierung.

### F. Sicherheits- und Migrationsqualität
- [ ] Jede produktive Tabelle folgt der deny-by-default-RLS-Strategie aus `docs/security/rls_target_architecture_2026-04-07.md`.
- [ ] Policy-Änderungen brauchen Positiv-/Negativtestfälle pro Rolle.
- [ ] Export- und Backup-Pfade dürfen nur freigegebene Ressourcen exportieren; freie Tabellenwahl in UI bleibt ausgeschlossen.
- [ ] Datenschutz-, Rollen- und Admin-Flows brauchen explizite `WITH CHECK`- und Rollenpfad-Reviews.
- [ ] Jede Migration dokumentiert Rollback-Idee, Datentransformationsrisiko und betroffene Routen/Services.

### G. Merge-Gates
- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `tsc --noEmit -p tsconfig.app.json`
- [ ] SQL-/RLS-Regression für betroffene Policies oder Views
- [ ] Keine Migration ohne fachliche und technische Review-Notiz

---

## 2) Testprioritäten

### P0 - sofort
1. Guards und Access-Resolver:
   - `isGuardAllowed`, Settings-Access-Regeln, Rollenauflösung, Self-vs-Admin-Pfade.
2. Query-Key-Normalisierung:
   - stabile Key-Factory, Gleichheit, Invalidation pro Domäne.
3. Error-Mapping:
   - Supabase-Fehler, Netzwerkfehler, Berechtigungsfehler, Validierungsfehler.
4. Kritische schreibende Services:
   - Privacy, Role Assignment, Team/Member-Administration, Schedule/Import.

### P1 - kurzfristig
1. Parser- und Mapping-Tests:
   - Import-Pipeline für QTTR/TTR, Pin/Code, Datums- und Team-Matching.
2. Service-Integration mit Mock-Supabase:
   - Board, Substitutes, Training, Seasons, Settings.
3. Routennahe Hook-Tests:
   - CRUD-Mutations, Settings-Forms, Navigation-Permissions.
4. Zod- oder Schema-Tests:
   - Privacy, Settings, Import, Admin-Massenoperationen.

### P2 - mittelfristig
1. Smoke-E2E mit Playwright:
   - Login, eine Kernroute pro Domäne, ein kritischer Schreibflow.
2. Performance-nahe Regressionen:
   - große Listen, Filter- und Mapping-Operationen, Export-/Import-Läufe.
3. Migrationsnahe SQL-Tests:
   - RLS-Matrix, View-Projektionen, Rollen- und Datenschutzgrenzen.

---

## 3) Architekturregeln

### A. UI, Route und State
1. Pages orchestrieren nur noch Route, Query-State und Präsentationskomponenten; Fachlogik bleibt in Services und Hooks.
2. Jede Route verwendet definierte Loading-, Empty-, Error- und Success-Zustände.
3. Routencluster mit hohem Risiko (`board`, `admin`, `import`, `settings`) erhalten eigene Boundary- und Error-State-Komponenten.
4. Komponenten lesen keine Tabellen direkt über Supabase-Clients.

### B. Services und Mapping
1. Jeder Service kapselt Query, Mapping, Fehlerübersetzung und Berechtigungsannahmen.
2. DB-Rows verlassen die Service-Schicht nicht roh.
3. Mapper sind deterministisch und separat testbar.
4. Import-, Privacy-, Export- und Admin-Domänen dürfen keine Sonderpfade in UI-Dateien behalten.

### C. React Query
1. Query Keys ausschließlich über Factory-Helfer.
2. Jede Mutation definiert exakt, welche Querys invalidiert oder optimistisch aktualisiert werden.
3. Keine duplizierten Query-Definitionen in mehreren Pages für dieselbe Ressource.

### D. Sicherheit und Berechtigung
1. Frontend-Guards sind nur UX-Schutz; fachliche Autorisierung bleibt in RLS und Services.
2. Rollen- und Rechteauflösung erfolgt zentral, nicht per Inline-Bedingung in Pages.
3. Datenschutz- und Admin-Funktionen trennen Self-Service, operative Bearbeitung und Systemadministration.

### E. Dokumentation und Migration
1. Architekturentscheidungen werden in datierten Dokumenten unter `docs/architecture` oder `docs/security` geführt und aus den Basisdokumenten verlinkt.
2. Größere Refactorings beschreiben Zielbild, Migrationsreihenfolge, Risiken und Tests.
3. Neue Domänen folgen dem bereits etablierten Muster aus Service-Layer-, Settings-, Privacy- und RLS-Dokumenten.

---

## 4) Refactoring-Liste

1. TSConfig konsolidieren und den Root-Container von widersprüchlichen Compilerflags befreien.
2. ESLint auf echte Qualitätsregeln anheben und Architekturverstöße technisch detektierbar machen.
3. Root-ErrorBoundary und domänenspezifische Boundary-Komponenten für kritische Routen einführen.
4. Zentrales Error-Modul mit Mapping, Log-Payload und User-Messages erstellen.
5. Direkte Supabase-Zugriffe schrittweise aus `Board.tsx`, `Admin.tsx`, `Import.tsx`, `Substitutes.tsx`, `Training.tsx`, `Members.tsx`, `Seasons.tsx` und Settings-Komponenten entfernen.
6. Query-Key-Migration auf die zentrale Factory abschließen; Ad-hoc-String-Keys abbauen.
7. Große Listen und Exporte auf paginierte, projektionierte Service-Queries umstellen.
8. P0-Testpaket aufbauen: Guards, Query Keys, Error-Mapping, kritische Services.
9. RLS- und Migrationsregressionen als Pflichtbestandteil für sicherheitsrelevante Änderungen einführen.
10. Technische Schulden wie `any`, rohe Tabellenexporte und generische Fehler-Toasts mit Ticket und Abbaufrist versehen.

---

## 5) Kritische Risiken

### P0 - aktuell blockierend
- Widersprüchliche TypeScript-Konfiguration zwischen Root und App-TSConfig schwächt die tatsächliche Type-Safety.
- Nahezu keine fachliche Testabdeckung schützt kritische Rollen-, Import-, Privacy- und Admin-Flows.
- Direkte Supabase-Zugriffe in Pages verhindern konsistente Fehlerbehandlung und saubere Autorisierungsgrenzen.

### P1 - kurzfristig adressieren
- Query-Key-Drift erzeugt fehlerhafte oder unnötig breite Cache-Invalidation.
- Fehlende ErrorBoundaries machen ganze Routencluster anfällig für einzelne Renderfehler.
- Große Listen und freie Exportmuster erzeugen Performance- und Datenschutzrisiken.
- Generische Fehlerbehandlung erschwert Incident-Analyse und verlängert Recovery-Zeiten.

### P2 - mittelfristig beobachten
- Fehlende Performance-Budgets und fehlende Smoke-E2E-Absicherung erhöhen das Regressionsrisiko bei weiterem Domänenausbau.
- Ohne klare Migrations- und Rollback-Konventionen steigt das Risiko fehlerhafter Produktivmigrationen.

---

## Priorisierte Umsetzung

### Phase 1
1. TSConfig und ESLint härten.
2. Root-ErrorBoundary plus zentrales Error-Mapping einführen.
3. P0-Tests für Guards, Query Keys und Error-Mapping ergänzen.

### Phase 2
1. Direkte Supabase-Zugriffe aus kritischen Pages in Services verschieben.
2. Query-Key-Fabrik vollständig durchsetzen.
3. Routencluster `board`, `admin`, `import`, `settings` mit eigenen Error-State-/Boundary-Komponenten absichern.

### Phase 3
1. RLS-Regressionen und Migrationschecks in CI verankern.
2. Smoke-E2E und Performance-nahe Regressionen ergänzen.
3. Qualitätsgates pro PR verbindlich machen.