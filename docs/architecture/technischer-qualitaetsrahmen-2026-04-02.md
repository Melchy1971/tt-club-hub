# Technischer Qualitätsrahmen (2026-04-02)

## Zielbild
Dieser Rahmen definiert ein verbindliches Qualitätsminimum für die nächsten Iterationen mit Fokus auf:
- vollständige TypeScript-Strictness,
- standardisierte Lint-/Fehlerklassen,
- robuste ErrorBoundary-Strategie,
- minimale, aber wirksame Testabdeckung in kritischen Domänen,
- CI-Gates als Freigabekriterien.

---

## 1) Qualitätscheckliste

### A. TypeScript Strict Mode vollständig absichern
- [ ] **Root-TSConfig entkoppeln oder harmonisieren:** Keine widersprüchlichen Flags (`noImplicitAny: false`, `strictNullChecks: false`) im Root-Setup.
- [ ] `strict: true` in allen aktiven App-TSConfigs (`tsconfig.app.json`, ggf. weitere Build-Targets) verbindlich.
- [ ] `noUncheckedIndexedAccess: true` aktivieren.
- [ ] `exactOptionalPropertyTypes: true` aktivieren.
- [ ] `useUnknownInCatchVariables: true` aktivieren.
- [ ] `noImplicitOverride: true` aktivieren.
- [ ] Keine neuen `as any`-Casts ohne dokumentierte Ausnahme.
- [ ] Alle externen Datenflüsse (Supabase/API) über explizite DTO- und Domain-Mapping-Typen.

### B. ESLint-Regeln und Fehlerklassen standardisieren
- [ ] ESLint von „recommended baseline“ auf projektweite Quality-Gates erweitern.
- [ ] `@typescript-eslint/no-unused-vars` aktivieren (statt `off`), mit `_`-Konvention für bewusst ungenutzte Parameter.
- [ ] `@typescript-eslint/no-explicit-any` als `error` (temporär ggf. `warn` mit Abbauplan).
- [ ] `@typescript-eslint/consistent-type-imports` als `error`.
- [ ] `@typescript-eslint/no-floating-promises` als `error` für asynchrone Safety.
- [ ] `@typescript-eslint/switch-exhaustiveness-check` als `error`.
- [ ] Fehlerklassen verbindlich: `DomainError`, `ValidationError`, `PermissionError`, `InfrastructureError`, `UnknownError`.
- [ ] Zentrales Error-Mapping Utility (Supabase-/Netzwerk-/Validierungsfehler -> UX-Message + Log-Kontext).

### C. ErrorBoundary-Strategie
- [ ] **App-weite Root ErrorBoundary** um Routing/Layout.
- [ ] **Domänen-Boundaries** für besonders fehleranfällige Bereiche (z. B. Import, Board, Schedule).
- [ ] Trennung von **render-time errors** (Boundary) und **async errors** (Error-State/React Query + Logging).
- [ ] Fallback-Komponenten mit Recovery-Aktion (z. B. „Neu laden“, „Zur Startseite“).
- [ ] Fehler-Protokollierung mit Kontext (`feature`, `operation`, `userRole`, `entityId`).
- [ ] Kein „stilles Schlucken“ von Fehlern in `catch`-Blöcken.

### D. Minimale Teststrategie für Services, Guards, RLS-nahe Logik
- [ ] Service-Unit-Tests für je Domäne mindestens `list` und eine schreibende Operation (`create/update/delete`).
- [ ] Guards/Access-Policy-Tests als reine Deterministik-Tests (rollen-/statusbasiert).
- [ ] RLS-nahe Logik: SQL-/Policy-Regressionstests für erlaubte und verbotene Rollenpfade.
- [ ] Schema-/Validator-Tests (Zod) für kritische Ein- und Ausgabedaten.
- [ ] Fehlerpfad-Tests (Timeout, Permission denied, Constraint violation).

### E. CI-relevante Prüfpunkte (Merge-Blocker)
- [ ] `npm run lint` muss fehlerfrei sein.
- [ ] `npm run test` muss fehlerfrei sein.
- [ ] `npm run build` muss fehlerfrei sein.
- [ ] `tsc --noEmit -p tsconfig.app.json` als expliziter Type-Gate.
- [ ] SQL-Migrations-Checks (Syntax + Policy-Regression) vor Merge.
- [ ] Keine ungeprüften Migrationen in PR ohne Test-/Rollback-Hinweis.

---

## 2) Testprioritäten (risikobasiert)

### Priorität P0 (sofort)
1. **Guards/Access Policies:** Rollen- und Berechtigungspfade (allow/deny) deterministisch absichern.
2. **RLS-nahe Servicepfade:** alle schreibenden Operationen mit Positiv-/Negativfällen.
3. **Error-Mapping:** korrekte Klassifizierung und user-taugliche Meldungen bei Supabase-/Netzwerkfehlern.

### Priorität P1 (kurzfristig)
1. **Kernservices je Domäne:** News, Team, Schedule, Training, Substitute.
2. **Zod-Schemas:** Grenzwerte, optionale Felder, Transformationslogik.
3. **React-Query-Invaliderungspfade:** nur betroffene Keys invalidieren.

### Priorität P2 (mittelfristig)
1. **Cross-Domain-Flows:** z. B. Import -> Schedule -> Availability.
2. **Smoke-E2E für kritische Journeys:** Auth + Kernfunktion je Domäne.
3. **Nichtfunktionale Checks:** Performance-Budgets für große Listen/Tabellen.

---

## 3) Refactoring-Liste

1. **TSConfig konsolidieren:** widersprüchliche Strictness-Flags entfernen, strengere Compiler-Optionen ergänzen.
2. **Lint-Policy hochziehen:** zentrale `.eslint`-Konvention mit klaren Schweregraden (`error`/`warn`) und technischem Schulden-Register.
3. **Error-Kernmodul einführen:**
   - Fehlerklassen,
   - Mapper für Supabase/Fetch/Validation,
   - `toUserMessage()` + `toLogPayload()`.
4. **ErrorBoundary-Layering implementieren:** Root + Domänen-Boundaries mit Standard-Fallback.
5. **Service-Verträge schärfen:** rohe DB-Responses nie direkt in UI, sondern über DTO->Domain-Mapping.
6. **Guard-Logik entkoppeln:** reine, testbare Policy-Funktionen ohne UI-Abhängigkeit.
7. **RLS-Test-Assets aufbauen:** standardisierte SQL-Testfälle (allowed/denied matrix) je Tabelle/Policy.
8. **CI-Pipeline erweitern:** Typecheck separat vom Build, Migration-/Policy-Checks als Pflichtjob.
9. **Technische Schulden begrenzen:** `any`/`ts-ignore` nur mit Ticket-Referenz und Ablaufdatum.

---

## 4) Build-/Runtime-Risiken

### Build-Risiken
- **Konfigurationsdrift:** Root- und App-TSConfig laufen auseinander -> unterschiedliche Ergebnisse lokal vs. CI.
- **Zu lockeres Linting:** Fehler wandern in Runtime, obwohl CI „grün“ ist.
- **Migrationsrisiko:** SQL-Änderungen ohne Policy-Regression verursachen Sicherheits- oder Integritätslücken.

### Runtime-Risiken
- **Unklassifizierte Fehler:** generische Toasts ohne Kontext erschweren Incident-Analyse.
- **Fehlende Boundaries:** einzelne Renderfehler können große UI-Bereiche unbrauchbar machen.
- **RLS/Permission-Fehler:** unsaubere Guard-/Policy-Abdeckung führt zu unberechtigtem Zugriff oder Blockade legitimer Aktionen.
- **Typlücken (`any`/unsaubere Casts):** Schema-Drift zwischen DB, Service und UI verursacht schwer reproduzierbare Bugs.

### Risikoreduktion (kurz)
- Typecheck + Lint + Tests + Build als harte Merge-Gates.
- Error-Klassifikation und Boundary-Rollout zuerst in den kritischsten Domänen.
- RLS-nahe Regressionstests für jede Policy-Änderung verpflichtend.
