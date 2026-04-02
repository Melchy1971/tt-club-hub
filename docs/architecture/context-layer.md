# Kontext-Schicht über Services (stabile API)

## Zielbild

Contexts sind **UI-orchestrierende Adapter** zwischen Komponenten und Services/React Query.

- **Services** sind die Datenzugriffs-Schicht (Supabase/API).
- **React Query** ist die Fetch-/Cache-Schicht für Server State.
- **Contexts** kapseln nur app-weite Querschnittslogik (Session, aktive Saisonphase, UI-Filter, Berechtigungs-Checks, Query-Selection).

Dadurch entsteht eine stabile, testbare API für Components und Pages.

---

## Schnittstellen je Context

Die formalen TypeScript-Interfaces liegen in `src/contexts/contracts.ts`.

### 1) AuthContext

**Verantwortung**
- Session-Lebenszyklus (`session`, `user`, `isAuthenticated`).
- Rollen aus Session und schneller Rollen-Check (`hasRole`, `hasAnyRole`).
- Auth-bezogene Aktionen (`refreshSession`, `signOut`).

**Nicht verantwortlich**
- Kein Rollen-/Permission-Katalog (das ist `RoleContext`).
- Kein Domain-Data-Caching.

### 2) RoleContext

**Verantwortung**
- Kanonische Rollen-Definitionen inkl. Labels.
- Permission-Mapping pro Rolle.
- Berechtigungsfunktionen (`can`, `canAny`, `canAll`).

**Nicht verantwortlich**
- Kein Session-Management.
- Keine User-spezifische Rollenauflösung aus Auth-Token.

### 3) SeasonContext

**Verantwortung**
- Aktive `season_phase` (Selection) und globale Saison-Filter.
- Reine UI-nahe Selektion (`setPhase`, `setFilters`, `clearFilters`).
- Optionales Prefetching nächster relevanter Saisondaten.

**Nicht verantwortlich**
- Kein Schatten-Store der Saisonlisten.
- Kein persistentes Server-Cache-Management außerhalb React Query.

### 4) ThemeContext

**Verantwortung**
- Aktuelles Theme (`light`/`dark`/`system`) und Umschalten.
- Persistenz des User-Themes (z. B. localStorage).

**Nicht verantwortlich**
- Kein API-Zugriff.
- Keine Domain-Berechtigungen.

### 5) NewsContext

**Verantwortung**
- News-bezogene UI-Parameter (Filter, Sortierung, Pagination, ausgewählte News).
- Delegation an React Query für Datenabfrage/Mutation.

**Nicht verantwortlich**
- Keine doppelte Speicherung der News-Liste im Context.

### 6) MemberDataContext

**Verantwortung**
- Leichter, sinnvoller App-weiter Cache für abgeleitete Member-ViewModel-Daten.
- Nur Derived Data (z. B. `memberId -> displayName/avatar`) als Read-Optimierung.

**Nicht verantwortlich**
- Kein Voll-Store für Mitgliederdaten.
- Keine Quelle der Wahrheit gegenüber React Query.

---

## Verantwortlichkeitsmatrix

| Bereich | AuthContext | RoleContext | SeasonContext | ThemeContext | NewsContext | MemberDataContext |
|---|---|---|---|---|---|---|
| Session/User | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Rollen-Checks (hasRole) | ✅ | ⚠️ (indirekt via Permission-Resolver) | ❌ | ❌ | ❌ | ❌ |
| Rollen-Katalog + Permissions | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Aktive season_phase | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Saison-Filter im UI | ❌ | ❌ | ✅ | ❌ | ⚠️ (nutzt ggf. Season-Filter) | ❌ |
| Theme/Umschaltung | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| News-UI-State | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Member Derived Cache | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Server State Cache (Quelle) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ *(React Query)* |

---

## Anti-Pattern-Liste

1. **Doppelte Datenhaltung**: React Query liefert `news[]`, Context hält parallel `news[]` als zweiten Store.
2. **God Context**: Ein Context bündelt Session, Permissions, News und Theme in einer API.
3. **Service-Bypass**: Context führt direkte Supabase-Queries aus, obwohl ein Domain-Service existiert.
4. **Permission-Logik im AuthContext**: Vollständige Permission-Matrix im AuthContext statt im RoleContext.
5. **MemberData als Schatten-Store**: Komplettes `members[]` im Context, obwohl Query vorhanden ist.
6. **Mutationen am Query-Cache vorbei**: Context setzt lokale Listen, ohne `queryClient.invalidateQueries`.
7. **Unklare Ownership von season_phase**: Aktiv-Phase in mehreren Stores mit divergierenden Werten.
8. **UI-spezifische Flags im falschen Context**: News-Sortierung im SeasonContext oder Session-Ladezustand im RoleContext.

---

## Integrationsplan mit React Query

### Phase 1: Verträge und Ownership fixieren
1. Interfaces (`contracts.ts`) einführen und gegen bestehende Contexts mappen.
2. Für jeden Context die „Single Responsibility“-Grenzen dokumentieren.
3. Query Keys für jede Domain standardisieren (z. B. `['news', filters]`, `['seasons', phaseId]`).

### Phase 2: Lesepfade auf Query umstellen
1. Listen-/Detaildaten ausschließlich mit `useQuery` laden.
2. Contexts halten nur Selection/Filter/Derived State.
3. Bestehende doppelte Context-State-Felder schrittweise entfernen.

### Phase 3: Schreibpfade konsolidieren
1. Mutationen über `useMutation` + Services ausführen.
2. Nach Erfolg gezielte `invalidateQueries` oder `setQueryData` anwenden.
3. Context aktualisiert nur UI-Selection, nicht die Server-Listen.

### Phase 4: Stabilisierung und Tests
1. Contract-Tests für Context-Hooks (API bleibt stabil).
2. Integrations-Tests für Query-Invalidierung und Re-Fetch-Verhalten.
3. Performance-Review: unnötige Re-Renders via `useMemo`/Selector Hooks reduzieren.

---

## Migrationsregeln (kurz)

- **Wenn Daten serverseitig leben** → React Query ist Quelle der Wahrheit.
- **Wenn Daten globaler UI-Steuerzustand sind** → Context.
- **Wenn Daten nur aus Query-Daten abgeleitet sind** → Derived Cache, kein eigener Server-State.

