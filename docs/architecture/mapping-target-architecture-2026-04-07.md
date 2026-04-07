# Zielarchitektur für DB-Row-, DomainModel- und ViewModel-Mapping (2026-04-07)

## Zielbild
Die Anwendung erhält für alle Kernmodule eine verbindliche Mapping-Kette:

1. `DB Row`: technisch am Supabase-Schema orientierte Struktur
2. `DomainModel`: fachlich bereinigtes Modell ohne Join-/Spaltenartefakte
3. `ViewModel`: UI-orientiertes Modell mit bereits aufgelösten Labels, Formatierungen und Null-Defaults

Ziel ist, dass UI-Komponenten niemals direkte Supabase-Row-Typen, `Tables<'...'>` oder rohe Join-Antworten rendern. Jede fachliche Domäne besitzt stattdessen eine klar definierte Mapper-Schicht, die technische Schuld durch inkonsistente Ad-hoc-Mappings abbaut.

---

## 1) End-to-End Mapping-Pattern

### A. Schichtenmodell

```text
Supabase Row / Join Row
  -> dbToDomain()
DomainModel
  -> domainToView()
ViewModel
  -> React-Komponente
```

### B. Regeln
1. `DB Row` darf Supabase-Namen, Join-Strukturen und Legacy-Felder enthalten.
2. `DomainModel` beschreibt ausschließlich fachliche Bedeutung und fachliche Invarianten.
3. `ViewModel` beschreibt ausschließlich, was die UI tatsächlich rendern muss.
4. Formatierung, Label-Auflösung und Null-Handling passieren spätestens im Übergang `DomainModel -> ViewModel`.
5. Services geben an die UI nur `ViewModel` oder `ApiResult<ViewModel>` zurück.
6. Supabase-`Tables<'...'>` und rohe Join-Objekte bleiben auf Service- und Mapper-Ebene.

### C. Standardvertrag

Bestehende Grundlage in `src/services/core/contracts.ts`:

- `DomainMapper<TDbRow, TDomainModel, TViewModel>`
- `dbToDomain(row)`
- `domainToView(model)`

Zielzustand pro Domäne:

```text
src/services/
  <domain>/
    <domain>.types.ts       # DbRow, DomainModel, ViewModel, Filter, DTO
    <domain>.mapper.ts      # dbToDomain, domainToView, optional dtoToDb
    <domain>.service.ts     # einzig erlaubter DB-Zugriff der Domäne
```

---

## 2) Gemeinsame Utilities

### A. Null-Handling
Vorhandene Basis in `src/services/core/mapping.ts`:

- `emptyStringToNull()`
- `nullToEmptyString()`
- `mapNullable()`
- `mapList()`

Zielerweiterung:
- `normalizeOptionalText(value)` für trim + null
- `normalizeNullableNumber(value)` für leere Strings / `NaN`
- `coalesceLabel(value, fallback = '–')`
- `coalesceArray(value)` für nullable Arrays aus Join-Queries

Regel:
- Leere Strings werden im DomainModel nicht als semantischer Zustand geführt, sondern zu `null` normalisiert.
- UI-spezifische Platzhalter wie `–`, `ohne Phase`, `keine Zuordnung` gehören ins ViewModel oder in den UI-Layer, nicht in DB-Mapper.

### B. Datums- und Zeitformatierung
Vorhandene Basis in `src/lib/date.ts`:

- `normalizeISODateValue()`
- `formatDate()`
- `formatDateTime()`
- `formatTime()`
- `formatRelative()`

Zielregel:
- `DB Row` und `DomainModel` behalten ISO-Daten.
- `ViewModel` darf zusätzlich formatierte Felder wie `matchDateLabel`, `publishedAtLabel`, `entryDateLabel` enthalten.
- UI-Komponenten formatieren keine Rohdaten ad hoc mehr mit lokalen `formatGermanDate()`-Hilfsfunktionen.

### C. Label-Resolver
Vorhandene Basis in `src/constants/uiLabels.ts`.

Zielregel:
- DomainMapper oder ViewMapper verwenden zentrale Resolver wie:
  - `getRoleLabel()`
  - `getAgeGroupLabel()`
  - `getPhaseTypeLabel()`
  - `getMatchStatusLabel()`
  - `getPermissionLevelLabel()`
- Komponenten kennen keine lokalen Status-/Rollen-/Phasen-Maps.

### D. Join-Row-Helfer
Zielergänzung in `src/services/core/mapping.ts` oder `src/services/core/joins.ts`:

- `pickJoinedRow()` für optionale Relationen
- `mapJoinedList()` für Supabase-Join-Arrays
- `unwrapSingleRelation()` für `foo:bar_id(*)`-Antworten
- `assertRequiredRelation()` für fachlich zwingende Relationen mit strukturiertem Fehler

---

## 3) Kernmuster pro Modul

### A. Profil

#### Ist-Zustand
- `profileInfoService` baut ein reiches Profil-ViewModel, enthält aber noch `any`-Rows und `MemberProfileViewModel.member: Tables<'members'>`.

#### Zielstruktur

```text
MemberProfileDbBundle
  -> MemberProfileDomainModel
  -> MemberProfileViewModel
```

#### DB Bundle
- `memberRow`
- `requesterRoleRows`
- `targetRoleRows`
- `teamAssignmentRows`
- `teamRosterRows`
- `trainingRows`

#### DomainModel-Beispiel
```ts
interface MemberProfileDomainModel {
  member: MemberDomainModel;
  roles: AppRole[];
  teams: MemberTeamDomainModel[];
  permissions: MemberProfilePermissionDomainModel;
}
```

#### ViewModel-Beispiel
```ts
interface MemberProfileViewModel {
  member: {
    id: string;
    fullName: string;
    email: string | null;
    ageGroup: string | null;
    ageGroupLabel: string | null;
    entryDateLabel: string | null;
  };
  roles: Array<{ role: AppRole; label: string }>;
  teams: Array<{
    teamId: string;
    name: string;
    ageGroupLabel: string | null;
    seasonPhaseName: string | null;
    trainingTimes: Array<{ startLabel: string; statusLabel: string }>;
  }>;
  permissions: {
    mode: 'self-service' | 'admin-board';
    canEditPersonalData: boolean;
    canManageRoles: boolean;
  };
}
```

#### Kernregel
- `Tables<'members'>` verschwindet aus `MemberProfileViewModel`.
- Rollenlabels, Altersgruppenlabels und Datumslabels werden im Mapper aufgelöst.

---

### B. Teams

#### Ist-Zustand
- `teamService` gibt überwiegend `Team` und `TeamOverview` direkt aus der DB-nahen Schicht zurück.

#### Zielstruktur

```text
TeamRow / TeamWithRosterRow
  -> TeamDomainModel / TeamRosterDomainModel
  -> TeamListItemViewModel / TeamDetailViewModel
```

#### DomainModel-Beispiel
```ts
interface TeamDomainModel {
  id: TeamId;
  name: string;
  league: string | null;
  ageGroup: AgeGroup;
  seasonPhaseId: SeasonPhaseId;
  captainId: MemberId | null;
  isActive: boolean;
}
```

#### ViewModel-Beispiel
```ts
interface TeamListItemViewModel {
  id: string;
  name: string;
  leagueLabel: string;
  ageGroupLabel: string;
  captainName: string | null;
  rosterSizeLabel: string;
  statusLabel: string;
}
```

#### Kernregel
- DB-Redundanzen wie `season_id` vs `season_cycle_id` werden im DomainModel konsolidiert.
- Die UI arbeitet nur noch mit lesbaren Team-ViewModels, nicht mit Rohfeldern plus lokalen Labels.

---

### C. Spielplan

#### Ist-Zustand
- `scheduleService` besitzt bereits ein implizites `toUI`, aber keine klar getrennte Domain-/ViewModel-Schicht.

#### Zielstruktur

```text
ScheduleMatchRow
  -> MatchDomainModel
  -> ScheduleMatchViewModel
```

#### DomainModel-Beispiel
```ts
interface MatchDomainModel {
  id: MatchId;
  teamId: TeamId;
  seasonPhaseId: SeasonPhaseId;
  date: string;
  time: string | null;
  opponent: string;
  isHome: boolean;
  status: MatchStatus;
  score: { home: number | null; away: number | null };
  pin: string | null;
  code: string | null;
}
```

#### ViewModel-Beispiel
```ts
interface ScheduleMatchViewModel {
  id: string;
  dateLabel: string;
  timeLabel: string;
  venueLabel: string;
  opponentLabel: string;
  homeAwayLabel: 'Heim' | 'Auswärts';
  status: MatchStatus;
  statusLabel: string;
  resultLabel: string;
  pinLabel: string;
  codeLabel: string;
}
```

#### Kernregel
- Alle lokalen `formatGermanDate`, Statusmaps und Anzeige-Fallbacks in Spielplan-Komponenten wandern in zentrale Mapper oder Utilities.

---

### D. Rollenmatrix

#### Ist-Zustand
- `Roles.tsx` baut Datenzugriff, Permission-Auflösung und UI-Form direkt in der Page zusammen.

#### Zielstruktur

```text
RoleRow + RolePermissionMatrixRow + UserRoleRow
  -> RoleMatrixDomainModel
  -> RoleMatrixViewModel
```

#### DomainModel-Beispiel
```ts
interface RoleMatrixDomainModel {
  roles: Array<{
    role: AppRole;
    isSystem: boolean;
    permissions: Record<ModuleKey, PermissionLevel>;
  }>;
  assignments: Array<{
    userId: string;
    role: AppRole;
  }>;
}
```

#### ViewModel-Beispiel
```ts
interface RoleMatrixViewModel {
  matrix: Array<{
    role: AppRole;
    roleLabel: string;
    cells: Array<{
      module: ModuleKey;
      moduleLabel: string;
      level: PermissionLevel;
      levelLabel: string;
    }>;
  }>;
  assignments: Array<{
    userId: string;
    memberName: string;
    roleLabel: string;
  }>;
}
```

#### Kernregel
- Die Page rendert nur noch die Matrix; Auflösung von Modul- und Level-Labels sowie Systemrollen-Logik gehört in Mapper/Service.

---

### E. News

#### Ist-Zustand
- `newsService` gibt `NewsRow` direkt zurück.

#### Zielstruktur

```text
NewsRow
  -> NewsDomainModel
  -> NewsCardViewModel / NewsAdminListItemViewModel
```

#### DomainModel-Beispiel
```ts
interface NewsDomainModel {
  id: string;
  title: string;
  content: string;
  publicationStatus: 'draft' | 'published';
  publishedAt: string | null;
  authorId: string;
  imageUrl: string | null;
}
```

#### ViewModel-Beispiel
```ts
interface NewsAdminListItemViewModel {
  id: string;
  title: string;
  teaser: string;
  publicationStatus: 'draft' | 'published';
  publicationStatusLabel: string;
  publishedAtLabel: string | null;
  audienceLabel: string;
  imageAvailable: boolean;
}
```

#### Kernregel
- Publikationsstatus und Sichtbarkeit werden im DomainModel semantisch geführt, nicht indirekt über `is_published` in der UI interpretiert.

---

## 4) Zielstruktur für Typen

### A. DB-nahe Typen
- liegen in domänenspezifischen `*.types.ts`
- dürfen `Tables<'...'>`, Join-Container und Legacy-Felder enthalten

### B. Domain-Typen
- liegen in `src/types/domain/*`
- beschreiben fachlich stabile Modelle
- vermeiden DB-spezifische Alias-Felder, wo möglich

### C. ViewModel-Typen
- liegen in `src/types/viewModels.ts` oder besser domänenspezifisch unter `src/types/view-models/*`
- enthalten:
  - Labels
  - formatierte Datums-/Zeitstrings
  - UI-Badges / Gruppen / Anzeige-Felder
  - keine Supabase-Typen

Empfehlung:

```text
src/types/
  domain/
    member.ts
    team.ts
    match.ts
    news.ts
  view-models/
    profile.vm.ts
    team.vm.ts
    schedule.vm.ts
    role-matrix.vm.ts
    news.vm.ts
```

---

## 5) Mapping-Utilities als Zielbestandteil

### `src/services/core/mapping.ts`
Soll mittelfristig die Standardbibliothek für alle Mapper werden:

- `emptyStringToNull`
- `nullToEmptyString`
- `mapNullable`
- `mapList`
- `normalizeOptionalText`
- `normalizeOptionalIsoDate`
- `formatDateLabel`
- `formatDateTimeLabel`
- `formatTimeLabel`
- `resolveAgeGroupLabel`
- `resolveRoleLabel`
- `resolveStatusLabel`

Regel:
- Mapper importieren diese Utilities, statt dieselben Helfer pro Service neu zu definieren.

---

## 6) Architekturregeln

1. Keine UI-Komponente importiert `Tables<'...'>` oder Supabase-Join-Rows.
2. Keine UI-Komponente baut lokale `mapToUI`- oder `...LABELS`-Sonderlogik für Kerndatenstrukturen.
3. Jeder Service definiert einen klaren Rückgabetyp: `ViewModel` für UI-Reads, `DomainModel` nur für interne Orchestrierung.
4. Mapper sind pure Funktionen und separat testbar.
5. DTO-Validierung (`create/update`) bleibt vor dem DB-Schreibpfad, nicht im ViewMapper.
6. Null-Handling und Legacy-Feldkonsolidierung passieren im `dbToDomain()`-Schritt.
7. Labels und Datumsausgaben entstehen im `domainToView()`-Schritt.

---

## 7) Refactoring-Prioritäten

### P0 - sofort
1. `profileInfoService`
   - `any`-Rows entfernen
   - `MemberProfileViewModel.member` von `Tables<'members'>` entkoppeln
   - expliziten `MemberProfileMapper` einführen
2. `Roles.tsx`
   - Datenzugriff aus der Page in `roleMatrixService` verschieben
   - `RoleMatrixViewModel` etablieren
3. `newsService`
   - direkte `NewsRow`-Rückgaben durch Domain-/ViewModel-Pipeline ersetzen

### P1 - kurzfristig
1. `teamService`
   - `TeamRow -> TeamDomainModel -> TeamListItemViewModel`
   - `listOverview()` auf Mapper umstellen
2. `scheduleService`
   - implizites `toUI` in dedizierten Mapper auslagern
   - Datums-/Status-/Venue-Labels zentralisieren
3. `memberService`
   - `mapMemberDbToUI` in `member.mapper.ts` verschieben
   - `MemberDomainModel` explizit einführen

### P2 - mittelfristig
1. `communicationListService`, `boardMeetingService`, `meetingDocumentService`
   - vereinheitlichte Mapper-Dateien statt lokale `mapToUI`
2. Import-/Export-Pipelines
   - trennen zwischen Import-Normalisierung, Domain-Konsolidierung und Preview-ViewModel
3. ViewModel-Typen aus `src/types/viewModels.ts` in domänenspezifische Dateien aufsplitten

---

## 8) Technische Schuld, die dadurch gezielt abgebaut wird

- lokale Mapper mit unterschiedlichem Null-Handling
- doppelte Datumsformatierung in Komponenten
- direkte Supabase- oder `Tables<'...'>`-Typen in UI-nahen Strukturen
- semantisch unklare Rückgabetypen (`Row`, `UI`, `DTO` gemischt)
- Pages mit versteckter Fachlogik für Rollenmatrix, Profilgruppen oder Publikationsstatus
- Drift zwischen DB-Feldern, Domänenbegriffen und Anzeigeformaten

---

## Kurzfazit
Die Anwendung besitzt bereits die Grundidee eines generischen Mapper-Vertrags, nutzt sie aber noch nicht konsistent. Die Zielarchitektur standardisiert diesen Vertrag zu einer vollständigen Kette `DB Row -> DomainModel -> ViewModel`, zentralisiert Null-Handling, Datumsausgabe und Label-Auflösung und priorisiert zuerst die Module mit dem höchsten fachlichen und technischen Risiko: Profil, Rollenmatrix, News, Teams und Spielplan.