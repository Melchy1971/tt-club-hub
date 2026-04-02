# Service-Layer Zielarchitektur (stabil) – 2026-04-02

## Zielsetzung

Diese Zielarchitektur standardisiert den kompletten Datenzugriff über Services und eliminiert direkte `supabase.from(...)`-Zugriffe aus UI-Komponenten/Pages.

Masterplan-Services:
- `memberService`
- `teamService`
- `teamAssignmentService`
- `scheduleService`
- `seasonService`
- `newsService`
- `roleService`
- `roleDefinitionService`
- `memberRoleAssignmentService`
- `boardMemberService`
- `boardMeetingService`
- `meetingDocumentService`

---

## 1) Ziel-Ordnerstruktur

```text
src/
  services/
    core/
      contracts.ts                 # Einheitliche Service-Kontrakte
      query.ts                     # Pagination/Sort/Filter-Normalisierung
      mapping.ts                   # Null-Handling + Mapper-Helfer
      crud-service.ts              # Reusable CRUD Factory
    member/
      member.types.ts              # DbRow / DomainModel / ViewModel / Filter
      member.mapper.ts             # db -> domain -> view
      member.service.ts            # Implementiert ServiceContract
    team/
      team.types.ts
      team.mapper.ts
      team.service.ts
    team-assignment/
      team-assignment.types.ts
      team-assignment.mapper.ts
      team-assignment.service.ts
    schedule/
      schedule.types.ts
      schedule.mapper.ts
      schedule.service.ts
    season/
      season.types.ts
      season.mapper.ts
      season.service.ts
    news/
      news.types.ts
      news.mapper.ts
      news.service.ts
    role/
      role.types.ts
      role.mapper.ts
      role.service.ts
    role-definition/
      role-definition.types.ts
      role-definition.mapper.ts
      role-definition.service.ts
    member-role-assignment/
      member-role-assignment.types.ts
      member-role-assignment.mapper.ts
      member-role-assignment.service.ts
    board-member/
      board-member.types.ts
      board-member.mapper.ts
      board-member.service.ts
    board-meeting/
      board-meeting.types.ts
      board-meeting.mapper.ts
      board-meeting.service.ts
    meeting-document/
      meeting-document.types.ts
      meeting-document.mapper.ts
      meeting-document.service.ts
```

Hinweis zur Migration: Bestehende `src/services/*.ts` bleiben zunächst als Fassade bestehen und delegieren intern auf neue Domain-Services.

---

## 2) Einheitliches Service-Kontrakt-Pattern

Jeder Service verwendet dieselbe Signaturfamilie:

- `list(query): Promise<ApiResult<PaginatedData<TViewModel>>>`
- `getById(id): Promise<ApiResult<TViewModel | null>>`
- `create(input): Promise<ApiResult<TViewModel>>`
- `update(id, input): Promise<ApiResult<TViewModel>>`
- `remove(id): Promise<ApiResult<void>>`

Erweiterungen pro Domäne (`assign`, `publish`, `archive`, `swapPositions`) bleiben erlaubt, müssen aber ebenfalls `ApiResult<...>` zurückgeben.

### Standardisierter Pipeline-Flow

1. **Input validation** (Zod Schema)
2. **Query normalization** (pagination/sort/filter defaults)
3. **DB access** (nur Service, nie UI)
4. **Mapping**: `DbRow -> DomainModel -> ViewModel`
5. **Error mapping** auf `AppError`
6. **Result wrapping** über `ok/err` bzw. `tryCatch`

---

## 3) Trennung: DB-Row vs. DomainModel vs. ViewModel

Pro Domäne werden drei klar getrennte Typen gepflegt:

- **DbRow**: 1:1 zu Supabase-Tabelle/View (snake_case)
- **DomainModel**: fachlich stabiles Modell (z. B. `seasonCycleId` statt Legacy-Felder)
- **ViewModel**: UI-optimierte Form (z. B. `displayName`, form-ready Nullable Strings)

Regel: UI konsumiert ausschließlich ViewModels oder dedizierte Query-DTOs, niemals DbRows.

---

## 4) Gemeinsame Base-Utilities (Standard)

### 4.1 CRUD-Basis

- `createCrudService(...)` kapselt Standardoperationen (`list/get/create/update/remove`)
- Entity-spezifische Services konfigurieren nur:
  - Tabellenname
  - Mapper
  - Validierungsschemata
  - erlaubte Sort-Felder

### 4.2 Query-Utilities

- `normalizePagination` (Default page/pageSize, Hard-Limits)
- `normalizeSort` (Allowlist, Fallback, Richtung)
- `buildRange` (`from`/`to` für Supabase)

### 4.3 Mapping-Utilities

- `emptyStringToNull`
- `nullToEmptyString`
- `mapNullable`
- `mapList`

### 4.4 Fehlerstandard

- Nur `AppError` nach außen
- Supabase-Fehler immer via `fromSupabaseError`
- Validierungsfehler immer `VALIDATION_ERROR`
- Keine rohe `throw new Error(...)` in UI-nahen Codepfaden

---

## 5) Governance-Regeln (DoD)

1. **No UI DB Access**: Kein `supabase.from(...)` außerhalb `src/services/**`.
2. **Result-Only Contracts**: Services liefern ausschließlich `ApiResult`.
3. **Mapper Pflicht**: Jede Domäne besitzt `*.mapper.ts`.
4. **Typed Query DTOs**: Filter/Pagination/Sort sind explizit typisiert.
5. **No legacy field leakage**: Legacy-DB-Felder verlassen die Service-Schicht nicht ungemappt.

---

## 6) Refactoring-Plan bestehender Datenzugriffe

### Phase 0 – Foundation (1 PR)

- `src/services/core` einführen (`contracts/query/mapping/crud`).
- Kontraktbeispiele für 1-2 Domänen (`member`, `team`) implementieren.
- ADR/Architekturdoku finalisieren.

### Phase 1 – UI-Supabase-Entkopplung (2-3 PRs)

Priorität A (hohe Trefferquote direkter Zugriffe):
- `src/pages/Board.tsx`
- `src/pages/Import.tsx`
- `src/pages/Roles.tsx`
- `src/pages/Training.tsx`
- `src/components/settings/*` (Club, Venues, Roles, Permissions, Profile)

Aktion:
- Jede direkte Query in dedizierte Services verschieben.
- Komponenten auf Service-Calls + Query Keys umstellen.

### Phase 2 – Masterplan-Services konsolidieren (mehrere PRs)

Für jeden Service:
1. `types` + `mapper` extrahieren
2. Kontrakt vereinheitlichen
3. Fehler-/Result-Handling angleichen
4. Tests auf Kontrakt-Ebene ergänzen

Reihenfolge empfohlen:
1. `memberService`
2. `teamService`
3. `teamAssignmentService`
4. `seasonService`
5. `scheduleService`
6. `newsService`
7. Rollen-Cluster (`role*`)
8. Board-Cluster (`board*`, `meetingDocument*`)

### Phase 3 – Legacy Cleanup

- Altes Interface entfernen
- Deprecated Service-Funktionen löschen
- Lint-Regel aktivieren:
  - `no-restricted-imports`: `@/integrations/supabase/client` in `pages/components/contexts/hooks` verbieten

---

## 7) Konkrete Migrationskandidaten aus aktuellem Stand

Direkte UI-Supabase-Zugriffe sind aktuell u. a. in folgenden Bereichen vorhanden und sollten zuerst auf Services migriert werden:

- `src/pages/Board.tsx`
- `src/pages/Import.tsx`
- `src/pages/Roles.tsx`
- `src/pages/Training.tsx`
- `src/pages/TeamSchedule.tsx`
- `src/components/settings/SettingsClub.tsx`
- `src/components/settings/SettingsVenues.tsx`
- `src/components/settings/SettingsRoles.tsx`
- `src/components/settings/SettingsPermissions.tsx`
- `src/components/settings/SettingsProfile.tsx`
- `src/contexts/AuthContext.tsx`

Damit ist das Ziel "keine UI-Komponente greift direkt auf `supabase.from(...)` zu" klar operationalisiert.
