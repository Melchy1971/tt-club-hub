# Admin-Domain Zielarchitektur – 2026-04-07

## Zielbild

Die Admin-Domain bündelt administrative Arbeit für:

- Mitglieder
- Mannschaften
- Spielplan
- Löschanfragen

Sie ist **kein zweites CRUD-System neben den Fachservices**, sondern eine fachliche Orchestrierung über bestehende Domänenservices mit:

- einheitlichen Admin-Listen und Detailabfragen
- vorbereiteten Sammelaktionen
- gemeinsamen Filter-, Sortier- und Suchkontrakten
- auditierbaren kritischen Änderungen
- hartem Zugriffsguard nur für `admin` und `vorstand`

Die Leitregel lautet:

- **Fachlogik bleibt in den Domänenservices.**
- **Admin-Services orchestrieren, validieren Berechtigungen, bündeln Bulk-Aktionen und Audit.**
- **UI greift nur auf Admin-Services oder Fachservices zu, nie direkt auf Supabase.**

---

## 1. Service-Struktur

## 1.1 Ziel-Ordnerstruktur

```text
src/
  services/
    admin/
      admin.types.ts
      admin.policy.ts
      admin.audit.ts
      admin.query.ts
      admin.bulk.ts
      members-admin.service.ts
      teams-admin.service.ts
      schedule-admin.service.ts
      deletion-requests-admin.service.ts
      index.ts
```

Diese Struktur ergänzt die bestehende Zielarchitektur in `src/services/core` und verwendet deren Kontrakte statt separater Patterns.

## 1.2 Verantwortlichkeiten pro Service

### `members-admin.service.ts`

Verantwortlich für:

- paginierte Admin-Listen für Mitglieder
- Admin-Detailansicht mit fachlich relevanten Kennzahlen
- Sammelaktionen wie Aktivieren, Deaktivieren, Rollen-/Teamprüfung vorbereiten
- Löschbarkeit und Abhängigkeiten vor kritischen Änderungen prüfen

Typische Admin-Operationen:

- `listMembersAdmin(query)`
- `getMemberAdminDetail(id)`
- `updateMemberAdmin(id, input)`
- `bulkUpdateMemberStatus(input)`
- `bulkExportMembers(query)`

### `teams-admin.service.ts`

Verantwortlich für:

- paginierte Teamlisten mit Kadergröße, Captain, Saisonkontext
- Team-Bearbeitung inkl. Typ (team_size: 4er/6er) und Click-TT Tabellen-Link (clicktt_url)
- Sammelaktionen wie Aktivierung/Deaktivierung, Phasenwechsel vorbereiten
- Teamlöschung nur mit Vorabprüfung auf abhängige Spiele/Kaderzuordnungen

Typische Admin-Operationen:

- `listTeamsAdmin(query)`
- `getTeamAdminDetail(id)`
- `updateTeamAdmin(id, input)`
- `bulkSetTeamActive(input)`
- `bulkMoveTeamsToSeasonPhase(input)`

### `schedule-admin.service.ts`

Verantwortlich für:

- paginierte Matchlisten für Admin mit Status, Venue, Teamkontext, Pin/Code-Flags
- Sammelaktionen wie Statuswechsel, Neuansetzung, Venue-/PIN-/Code-Updates vorbereiten
- harte Vorprüfung für konfliktträchtige Massenupdates

Typische Admin-Operationen:

- `listScheduleAdmin(query)`
- `getMatchAdminDetail(id)`
- `updateMatchAdmin(id, input)`
- `bulkUpdateMatchStatus(input)`
- `bulkAssignVenue(input)`
- `bulkUpdatePinCode(input)`

### `deletion-requests-admin.service.ts`

Verantwortlich für:

- Admin-Liste für Löschanfragen mit Status, Antragsteller, Review-Kontext
- Freigabe-/Ablehnungsworkflow mit Statusmaschine
- Vorbereitung einer späteren orchestrierten Member-Löschung

Typische Admin-Operationen:

- `listDeletionRequestsAdmin(query)`
- `getDeletionRequestAdminDetail(id)`
- `reviewDeletionRequest(id, decision)`
- `bulkReviewDeletionRequests(input)`
- `prepareDeletionExecution(id)`

## 1.3 Schichtung

Jeder Admin-Service folgt derselben Aufteilung:

1. `policy guard`
2. `input validation`
3. `query/filter normalization`
4. `fachservice orchestration`
5. `audit write`
6. `ApiResult` zurückgeben

Die Admin-Schicht darf Domänenservices kombinieren, aber keine Domäneninvarianten duplizieren.

## 1.4 Zugriffsguard

Admin-Services sind ausschließlich für `admin` und `vorstand` freigegeben.

Empfehlung:

- neue Utility `assertAdminDomainAccess(roles)`
- akzeptiert nur Rollenmenge mit `admin` oder `vorstand`
- `developer` soll technisch nicht implizit Admin-Domain-Zugriff erhalten, außer dies wird explizit separat freigegeben

Begründung: Die bestehende globale Permission-Logik behandelt `developer` sehr breit. Für die Admin-Domain ist das zu unscharf und sollte fachlich explizit gemacht werden.

---

## 2. Gemeinsame Admin-Utilities

## 2.1 Gemeinsame Query-Modelle

Auf Basis von `src/services/core/contracts.ts` sollte die Admin-Domain gemeinsame Query-DTOs nutzen:

```ts
type AdminSearchMode = 'prefix' | 'contains' | 'exact';

interface AdminBaseFilter {
  search?: string;
  searchMode?: AdminSearchMode;
  isActive?: boolean;
  seasonCycleId?: string;
  seasonPhaseId?: string;
  updatedFrom?: string;
  updatedTo?: string;
}

interface AdminSelectionInput {
  ids: string[];
  selectAll?: boolean;
  queryFingerprint?: string;
}

interface BulkActionInput<TPayload> {
  selection: AdminSelectionInput;
  payload: TPayload;
  dryRun?: boolean;
  reason?: string;
}
```

Ziel:

- gleiche Selektionslogik für Sammelaktionen
- gleiche Such-/Filter-Semantik über alle Admin-Tabellen
- gleiche `dryRun`-Fähigkeit

## 2.2 Filter-Utilities

`admin.query.ts` sollte wiederverwendbare Helfer enthalten:

- `normalizeAdminSearch(term)`
- `buildAdminDateRange(filter)`
- `normalizeBooleanFilter(value)`
- `resolveSelectionScope(selection, query)`
- `ensureBulkSelectionWithinLimit(selection, max)`

Regeln:

- Freitextsuche immer trimmen und Mehrfachspaces reduzieren
- Suche über definierte Feld-Allowlist je Entität
- keine freie Sortierung oder Filterung auf beliebigen DB-Feldern

## 2.3 Sortier-Utilities

Jede Entität bekommt eine Feld-Allowlist und ein Fallback:

- Mitglieder: `lastName`, `firstName`, `memberNumber`, `entryDate`, `updatedAt`
- Mannschaften: `name`, `league`, `ageGroup`, `rosterSize`, `updatedAt`
- Spielplan: `matchDate`, `matchDay`, `homeTeam`, `awayTeam`, `status`, `updatedAt`
- Löschanfragen: `createdAt`, `status`, `reviewedAt`, `memberLastName`

Empfohlene Konvention:

- primäres Sortfeld über `normalizeSort`
- stabiler Tie-Breaker immer `id` oder `created_at`

## 2.4 Such-Utilities

Die Admin-Suche sollte nicht in jeder Page neu definiert werden.

Empfehlung:

- `buildMemberAdminSearch(query)`
- `buildTeamAdminSearch(query)`
- `buildScheduleAdminSearch(query)`
- `buildDeletionRequestAdminSearch(query)`

Beispiele:

- Mitglieder: Name, E-Mail, Mitgliedsnummer
- Mannschaften: Name, Liga, Staffel
- Spielplan: Heimteam, Auswärtsteam, Matchday, Venue
- Löschanfragen: Mitgliedsname, Antragsteller, Status

## 2.5 Bulk-Utilities

`admin.bulk.ts` sollte standardisieren:

- Chunking
- Dry-Run-Report
- Teilfehlerbehandlung
- Fortschrittsmetriken
- Undo-fähige Ergebnisstruktur, sofern fachlich möglich

Empfohlene Antwortstruktur:

```ts
interface BulkActionResult {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  dryRun: boolean;
  issues: AdminBulkIssue[];
}
```

## 2.6 Policy-Utilities

`admin.policy.ts` sollte zentrale Guards enthalten:

- `assertAdminDomainAccess(auth)`
- `assertAdminDomainMutationAccess(auth)`
- `assertBulkActionAllowed(action, auth)`
- `assertDeletionTransitionAllowed(from, to)`

Diese Guards verhindern, dass Rollenchecks in Komponenten oder Einzelfunktionen dupliziert werden.

---

## 3. Audit-Regeln

## 3.1 Audit-Prinzipien

Kritische Admin-Änderungen müssen immer protokolliert werden, insbesondere:

- Löschungen und Deaktivierungen
- Statuswechsel mit fachlicher Wirkung
- Sammelaktionen mit vielen Zielobjekten
- Änderungen an Rollen-, Zugriffs- oder sensitiven Matchfeldern
- Entscheidungen zu Löschanfragen

Nicht jede Leseabfrage braucht Audit. Schreibende und sicherheitsrelevante Admin-Aktionen dagegen immer.

## 3.2 Neue Audit-Aktionsgruppen

Die bestehende `src/lib/audit.ts`-Liste sollte mindestens um folgende Admin-Aktionen ergänzt werden:

- `admin.member.bulk_update`
- `admin.member.bulk_deactivate`
- `admin.team.bulk_update`
- `admin.team.bulk_reassign_phase`
- `admin.match.bulk_update`
- `admin.match.bulk_update_pin_code`
- `admin.deletion_request.approve`
- `admin.deletion_request.reject`
- `admin.deletion_request.bulk_review`
- `admin.export.members`
- `admin.export.teams`
- `admin.export.schedule`
- `admin.export.deletion_requests`

Zusätzlich sollten bestehende Einzelaktionen ergänzt oder präzisiert werden:

- `team.delete`
- `match.update`
- `match.delete`
- `deletion_request.create`
- `deletion_request.update_status`

## 3.3 Audit-Payload-Minimum

Jedes kritische Admin-Audit-Event sollte mindestens enthalten:

- `actorUserId`
- `actorRole`
- `entity`
- `entityId` oder `selectionSummary`
- `action`
- `before`
- `after`
- `reason`
- `source: 'admin-domain'`
- `correlationId`
- `dryRun`

Bei Bulk-Aktionen zusätzlich:

- `targetCount`
- `successCount`
- `failedCount`
- `skippedCount`
- `sampleEntityIds`

## 3.4 Audit-Regeln pro Entität

### Mitglieder

Immer auditieren bei:

- Löschung
- Deaktivierung/Reaktivierung
- Änderung von `email`, `member_number`, `is_active`, `user_id`
- Bulk-Statusänderung

Optional auditieren bei:

- rein redaktionellen Änderungen wie `phone` oder `city`, wenn kein Compliance-Bedarf besteht

### Mannschaften

Immer auditieren bei:

- Löschung
- Aktiv-/Inaktiv-Schaltung
- Saison-/Phasenwechsel
- Captain-/Kader-bezogenen Admin-Massenänderungen

### Spielplan

Immer auditieren bei:

- Löschung
- Statuswechsel (`geplant`, `verschoben`, `abgesagt`, `gespielt`)
- Bulk-Venue-Updates
- Bulk-PIN/Code-Updates
- Match-Datum-/Zeit-Änderungen

### Löschanfragen

Immer auditieren bei:

- Genehmigung
- Ablehnung
- Übergang nach `executing`
- Abschluss `completed`

## 3.5 Fehlerverhalten im Audit

Audit-Schreiben bleibt non-fatal, aber:

- Bulk-Ergebnisse müssen anzeigen, wenn Audit teilweise fehlgeschlagen ist
- Fehler in Audit dürfen nicht still verschwinden, sondern als `warning` im Admin-Ergebnis auftauchen

---

## 4. Refactoring-Plan

## Phase 1: Verträge und Utilities stabilisieren

1. `memberService` auf `ApiResult`-Kontrakt angleichen, damit Admin-Services nicht zwei Fehlermodelle unterstützen müssen.
2. `admin.policy.ts`, `admin.query.ts`, `admin.bulk.ts`, `admin.types.ts` einführen.
3. Audit-Action-Typen und Audit-Wrapper für Admin ergänzen.

Ergebnis:

- gemeinsames Fehler- und Query-Modell
- kein throw-/ApiResult-Mischbetrieb in der Admin-Domain

## Phase 2: Löschanfragen und Admin-Lesezugriffe extrahieren

1. `deletion-requests-admin.service.ts` auf Basis von `privacyService` einführen.
2. Admin-Listen für Mitglieder, Teams und Spielplan aus `Admin.tsx` in dedizierte Services verschieben.
3. Query-Key-Fabrik für Admin einführen, z. B. `adminKeys.members.list(query)`.

Ergebnis:

- `Admin.tsx` verliert direkte `supabase.from(...)`-Zugriffe
- erste konsistente Admin-Read-Schicht steht

## Phase 3: Schreiboperationen und Sammelaktionen umstellen

1. Einzelmutationen aus `Admin.tsx` in Admin-Services verschieben.
2. Sammelaktions-DTOs und `dryRun`-Flows implementieren.
3. Kritische Änderungen an Audit koppeln.

Ergebnis:

- UI nutzt nur noch Service-Aufrufe
- Bulk-Aktionen werden technisch vorbereitet, auch wenn die UI sie zunächst noch nicht vollständig anbietet

## Phase 4: Rollen- und Zugriffshärtung

1. Admin-Routen und Admin-Services auf `admin|vorstand` begrenzen.
2. UI-Guard und Service-Guard angleichen.
3. Optional DB-seitige RPCs oder Views für Admin-Read-Modelle absichern.

Ergebnis:

- keine Divergenz zwischen UI-Sichtbarkeit und Server-seitiger Erlaubnis

## Phase 5: Cleanup

1. Ad-hoc-Such-/Filterlogik aus `Admin.tsx` entfernen.
2. Inline-Mutationen und direkte Tabellenzugriffe löschen.
3. Lint-Regel erweitern: keine direkten Supabase-Imports in Admin-Page/Dialogs.

---

## 5. Edge Cases

## 5.1 Rollen und Zugriff

- Nutzer hat mehrere Rollen, aber `vorstand` ist nur sekundär vorhanden.
  Regel: Zugriff über effektive Rollenmenge, nicht nur Primärrolle.
- UI erlaubt Zugriff, Service verweigert ihn.
  Regel: Service-Guard ist maßgeblich; UI nur Komfortschicht.
- Bestehende `developer`-Sonderrechte kollidieren mit Admin-Domain-Regel.
  Regel: explizit entscheiden und dokumentieren, nicht implizit übernehmen.

## 5.2 Sammelaktionen

- Auswahl enthält IDs, die durch aktuellen Filter gar nicht mehr sichtbar wären.
  Regel: Server-seitig Auswahl gegen Query-Scope validieren.
- Teil der IDs ist inzwischen gelöscht oder geändert.
  Regel: Teilfehler zulassen, sauber reporten.
- Bulk-Update greift auf gesperrte oder fachlich unzulässige Datensätze.
  Regel: `skipped` oder `failed` je Datensatz, nie Komplettabbruch ohne Not.

## 5.3 Mitglieder

- Mitglied mit verknüpftem `user_id` soll gelöscht werden.
  Regel: vorab Abhängigkeiten und Datenschutzworkflow prüfen.
- Inaktive Mitglieder erscheinen in Suchergebnissen nicht konsistent.
  Regel: `isActive` immer explizit im Filtermodell führen.
- Duplikat über `email` oder `member_number` bei Sammelaktion.
  Regel: Konflikt pro Datensatz reporten, nicht still überschreiben.

## 5.4 Mannschaften

- Team ohne Saisonphase oder mit Legacy-`season_id`.
  Regel: Mapper vereinheitlichen und Legacy-Feld nie direkt in die Admin-UI reichen.
- Team-Löschung trotz bestehender Spiele.
  Regel: als blockierender Fehler oder Soft-Delete-Strategie behandeln.

## 5.5 Spielplan

- Match ist verschoben/abgesagt und wird trotzdem in Bulk-Aktion bearbeitet.
  Regel: Policy entscheidet pro Aktion, ob zulässig oder `skipped`.
- Bulk-PIN/Code-Update überschreibt bestehende operative Werte.
  Regel: nur mit Audit und idealerweise `dryRun`-Vorschau.
- Heim-/Auswärts- und Venue-Konflikte bei Venue-Sammelaktion.
  Regel: nur Heimspiele automatisch mit Venue-Massenupdate verändern.

## 5.6 Löschanfragen

- Statusübergang verletzt die definierte Zustandsmaschine.
  Regel: hart blockieren.
- Anfrage wurde parallel bereits reviewed.
  Regel: optimistic concurrency oder erneutes Laden vor Persistenz.
- `approved` bedeutet nicht automatisch sofortige Löschung.
  Regel: Approval und Execution als getrennte Zustände behandeln.

---

## 6. Konkrete technische Empfehlungen

1. `Admin.tsx` in reine Orchestrierungs- und Präsentationslogik zurückbauen.
2. `memberService` zuerst auf `ApiResult` vereinheitlichen, weil die Admin-Domain sonst ständig zwischen Fehlerstilen übersetzen muss.
3. `privacyService` nicht direkt in der UI verwenden, sondern über `deletion-requests-admin.service.ts` kapseln.
4. Für Admin-Sammelaktionen von Anfang an `dryRun` und `selection + queryFingerprint` vorsehen.
5. Audit nicht nur für Deletes, sondern für administrative Status- und Massenänderungen ausbauen.
6. Admin-Zugriff fachlich explizit auf `admin` und `vorstand` begrenzen und nicht allein aus der allgemeinen Permission-Matrix ableiten.

## 7. Beziehung zur bestehenden Architektur

Diese Admin-Domain erweitert die Zielarchitektur aus:

- `docs/architecture/service-layer-target-architecture-2026-04-02.md`
- `docs/architecture/technical-final-review-2026-04-01.md`
- `docs/architecture/backup-export-strategy-2026-04-07.md`

Sie schließt insbesondere drei aktuell sichtbare Lücken:

- direkte Supabase-Zugriffe in `Admin.tsx`
- inkonsistente Service-Kontrakte zwischen Mitgliedern und übrigen Domänen
- fehlende technische Grundlage für sichere Admin-Sammelaktionen
