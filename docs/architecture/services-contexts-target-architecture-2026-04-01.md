# Zielarchitektur: Services + Contexts (konsistent, UI-datenlogikfrei)

## Ergänzende Zielbilder 2026-04-07

Für die neueren anwendungsweiten Zielbilder siehe zusätzlich:

- `docs/architecture/service-layer-target-architecture-2026-04-02.md`
- `docs/architecture/mapping-target-architecture-2026-04-07.md`
- `docs/architecture/technical-quality-framework-2026-04-07.md`
- `docs/architecture/ui-label-standardization-2026-04-07.md`

## 1) Zielstruktur

```text
src/
  services/
    _shared/
      serviceResult.ts            # Result<T, AppError>
      serviceError.ts             # Domänenfehler + Mapper
      queryKeyFactory.ts          # createDomainKeys(domain)
      queryOptions.ts             # standard stale/gc/retry presets
    member/
      member.service.ts
      member.types.ts
      member.mapper.ts
    team/
      team.service.ts
      team.types.ts
      team.mapper.ts
    teamAssignment/
      teamAssignment.service.ts
      teamAssignment.types.ts
    schedule/
      schedule.service.ts
      schedule.types.ts
    season/
      season.service.ts
      season.types.ts
    news/
      news.service.ts
      news.types.ts
    role/
      role.service.ts
      role.types.ts
    roleDefinition/
      roleDefinition.service.ts
      roleDefinition.types.ts
    memberRoleAssignment/
      memberRoleAssignment.service.ts
      memberRoleAssignment.types.ts
    boardMember/
      boardMember.service.ts
      boardMember.types.ts
    boardMeeting/
      boardMeeting.service.ts
      boardMeeting.types.ts
    meetingDocument/
      meetingDocument.service.ts
      meetingDocument.types.ts

  contexts/
    AuthContext.tsx
    RoleContext.tsx
    SeasonContext.tsx
    ThemeContext.tsx
    NewsContext.tsx
    MemberDataContext.tsx

  hooks/
    useDomainQuery.ts             # Wrapper um useQuery mit Defaults
    useDomainMutation.ts          # Wrapper um useMutation + Fehlerhandling

  lib/
    queryKeys.ts                  # nur zentrale Domain-Keys (Factory-basiert)
    error.ts                      # AppError + Normalisierung

  features/
    <feature>/
      queries.ts                  # useQuery/useMutation + Query Keys
      selectors.ts                # UI-nahe Ableitungen
      components/
      pages/
```

### Zielbild der Verantwortlichkeiten
- **Services** kapseln ausschließlich IO/CRUD/Policies pro Domäne.
- **Contexts** liefern globalen Session-/UI-/Anwendungszustand (kein direkter DB-Zugriff in Komponenten).
- **Feature Queries** verbinden React Query mit Services.
- **UI-Komponenten/Seiten** konsumieren nur Hooks/Contexts und enthalten keine Supabase-/Fetch-Details.

---

## 2) Abhängigkeitsregeln

## Erlaubte Richtung
1. `UI (pages/components)` → `feature hooks/selectors` → `services` → `supabase/api`.
2. `contexts` dürfen `services` nutzen, aber keine UI-Imports besitzen.
3. `services/<domain>` dürfen `services/_shared` und `types` nutzen.
4. `services` dürfen **nicht** aus `pages`, `components`, `contexts` importieren.

## Verbote (hart)
- Kein Datenzugriff (`supabase.from`, `fetch`) in `src/pages/**` oder `src/components/**`.
- Kein Query-Key-String-Literal außerhalb von `lib/queryKeys.ts` bzw. Domain-Key-Factory.
- Keine rohe Fehlerbehandlung in UI (`error.message` direkt rendern ohne Mapping).

## Qualitätsgates
- ESLint-Regel `no-restricted-imports` für `supabase/client` in UI-Layern.
- Optional Architektur-Lint (z. B. `eslint-plugin-boundaries`) für Layer-Grenzen.
- Jede Mutation invalidiert Query Keys ausschließlich über zentrale Key-Factories.

---

## 3) Service-Kontrakte

## Einheitlicher Rückgabetyp

```ts
type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };
```

## Standard-Interface je Domäne

```ts
interface CrudService<TItem, TFilter, TCreate, TUpdate> {
  list(filter?: TFilter): Promise<ServiceResult<TItem[]>>;
  getById(id: string): Promise<ServiceResult<TItem>>;
  create(input: TCreate): Promise<ServiceResult<TItem>>;
  update(id: string, input: TUpdate): Promise<ServiceResult<TItem>>;
  remove(id: string): Promise<ServiceResult<void>>;
}
```

## Domänenspezifische Erweiterungen
- `teamAssignmentService`: `assignMember`, `unassignMember`, `listByTeam`, `listByMember`.
- `scheduleService`: `listBySeason`, `listByTeam`, `publishMatch`, `setResult`.
- `seasonService`: `getActive`, `activate`, `archive`.
- `newsService`: `listPublic`, `listInternal`, `publish`, `unpublish`.
- `roleDefinitionService`: `listDefinitions`, `syncSystemDefinitions`.
- `memberRoleAssignmentService`: `assignRole`, `revokeRole`, `listByMember`.
- `boardMeetingService`: `createWithAgenda`, `closeMeeting`, `listBySeason`.
- `meetingDocumentService`: `uploadForMeeting`, `listForMeeting`, `deleteForMeeting`.

## Query-Key-Standard (konsequent)
- Schema je Domäne: `[domain, scope, ...params]`.
- Pflicht-Segmente: `all`, `list`, `detail`; optional `relations`, `stats`, `meta`.
- Filterparameter immer als stabiles Objekt im letzten Segment.

Beispiel:

```ts
const keys = createDomainKeys('member');
keys.all;          // ['member']
keys.list({ teamId, active: true });
keys.detail(id);
keys.relation('roles', memberId);
```

## Fehlerbehandlung-Standard
- Jede Service-Methode mappt Backend-Fehler auf `AppError` (z. B. via `fromSupabaseError`).
- UI bekommt nur `AppError` (code/message/details), keine Rohfehler.
- `useDomainMutation` zeigt Toasts über Error-Code-Mapping (z. B. `CONFLICT`, `FORBIDDEN`).
- `useDomainQuery` verwendet gemeinsame Defaults (`retry`, `staleTime`, `gcTime`) pro Datenklasse.

---

## 4) Refactoring-Plan (inkrementell, risikoarm)

## Phase 0 – Leitplanken (1 Tag)
1. `services/_shared` einführen (`ServiceResult`, Error-Mapping, Query-Key-Factory).
2. Query-Key-Namenskonvention in `lib/queryKeys.ts` harmonisieren.
3. ESLint-Grenzen für UI ohne Datenzugriff aktivieren.

## Phase 1 – Service-Normalisierung (2–3 Tage)
1. Bestehende Services auf Domänenordner migrieren (ohne API-Änderung).
2. Für alle Zielservices einheitliche Kontrakte + Rückgabetypen herstellen.
3. Domänenspezifische Methoden ergänzen (siehe Kontrakte).

## Phase 2 – Context-Konsolidierung (1–2 Tage)
1. Fehlende Contexts ergänzen: `Role`, `Theme`, `News`, `MemberData`.
2. `AuthContext` liefert nur Auth/Session-Basisdaten.
3. Rollenlogik aus UI in `RoleContext` zentralisieren.
4. `NewsContext` für globale Feeds/Unread-Zähler (servicebasiert).

## Phase 3 – Feature-Hooks statt UI-IO (2–4 Tage)
1. Pro Feature `queries.ts` mit `useQuery/useMutation` + zentralen Keys.
2. Direkte Datenzugriffe in Pages/Components entfernen.
3. Mutationen auf standardisierte Invalidierungsstrategien umstellen.

## Phase 4 – Stabilisierung & Tests (1–2 Tage)
1. Service-Tests: Erfolg, Validation, Forbidden, NotFound, Conflict.
2. Context-Tests: Loading-, Refresh-, Error- und Auth-Wechsel-Szenarien.
3. Smoke-Tests für Kernseiten (`Members`, `Teams`, `Schedule`, `Board`, `News`).

## Phase 5 – Abschlusskriterien
- 0 Vorkommen von `supabase.from(` in `pages/**` und `components/**`.
- Alle Zielservices folgen `ServiceResult` + Error-Mapping.
- Alle Queries/Mutations nutzen zentrale Query Keys.
- Contexts vollständig vorhanden: `Auth`, `Role`, `Season`, `Theme`, `News`, `MemberData`.

---

## 5) Migrationsreihenfolge für die genannten Domänen
1. `member` + `team` (Basis für viele Relationen)
2. `teamAssignment` + `memberRoleAssignment`
3. `role` + `roleDefinition`
4. `season` + `schedule`
5. `news`
6. `boardMember` + `boardMeeting` + `meetingDocument`

Diese Reihenfolge minimiert Querabhängigkeiten und reduziert temporäre Adapter.
