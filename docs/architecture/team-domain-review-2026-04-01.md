# Team-Domain Review (2026-04-01)

## Zielbild

Die Team-Domain trennt ab jetzt klar zwischen:

- **`teams`**: Team-Stammdaten (Liga, Altersklasse, `season_phase_id`, Kapitän).
 - Zusätzliche Felder: `team_size` (4 oder 6 für 4er/6er-Mannschaft), `clicktt_url` (Link zur Click-TT Tabelle).
- **`team_members`**: technische Kader-/Positionszuordnung pro Team.
- **`member_team_assignments` (Service-View)**: fachliche Sicht pro Mitglied inkl. Saisonphase und Kapitänsflag (ohne eigene DB-Tabelle).

## Service-APIs

### `teamService`

- `list(filters)`
  - Filter auf `season_phase_id`, optional aktive Phase (`active_phase`).
- `getByActiveSeason()`
  - Alias auf aktive Saisonphase und aktive Teams.
- `getById(id)`
- `getWithRoster(id)`
  - Team inkl. `team_members` + `members`.
- `create(input)`
  - **phase-first**: `season_id` ist optional und wird aus `season_phase_id` aufgelöst.
- `update(id, input)`
  - Bei Änderung `season_phase_id` wird `season_id` automatisch synchronisiert.
- `remove(id)`
- `listOverview(filters)`
  - performante Teamübersicht inkl. Kadergröße und Kapitän.

### `teamAssignmentService`

- `getByTeam(teamId)`
  - kompletter Kader eines Teams, sortiert nach Position.
- `getByMember(memberId, seasonId?, seasonPhaseId?, activePhase?)`
  - direkte Join-Filterung statt Team-ID-Subquery.
- `getMemberTeamAssignments(memberId, options)`
  - fachliche Assignment-Sicht (`member_team_assignments`) auf Basis von `team_members + teams`.
- `assign(teamId, memberId, position)`
- `unassign(teamId, memberId)`
- `swapPositions(teamId, memberId1, memberId2)`
- `setRoster(teamId, entries)`
- `getAvailableMembers(teamId)`
- `getTeamTrainingTimes(teamId, fromDate?, toDate?)`
  - Trainingszeiten über Teamkader-Mitglieder (`requester_id`/`partner_id`) aggregiert.

## DB-Review

### Bereits gut abgesichert

1. `teams.season_phase_id` ist NOT NULL und Trigger validiert Konsistenz zu `season_id`.
2. `team_members` hat starke Constraints:
   - `UNIQUE(team_id, member_id)`
   - `UNIQUE(team_id, position)`
   - `CHECK(position >= 0)`
3. Indexe für Teamzuordnungen vorhanden (`member_id`, `(member_id, team_id)`).

### Offene Punkte / Empfehlungen

1. **Supabase Type-Gen** ist veraltet (`season_phase_id` noch nullable). Ein `supabase gen types` sollte nachgezogen werden.
2. Für `listOverview` wäre eine DB-View/Materialized View sinnvoll, falls Teamanzahl stark wächst.
3. `getTeamTrainingTimes` nutzt aktuell indirekte Zuordnung über Mitglieder (kein `team_id` an `training_bookings`). Falls fachlich relevant, zusätzliche Relation (`team_id`) erwägen.
4. `swapPositions`/`setRoster` sind nicht voll atomar. Für harte Konsistenz bei Parallelität: RPC-Funktion mit Transaktion.

## Edge Cases

1. **Ungültige Saisonphase bei Team-Create/Update**
   - Service liefert NotFound statt inkonsistenter Daten.
2. **Saisonphase-Wechsel ohne season_id**
   - `season_id` wird automatisch aus Phase nachgezogen.
3. **Doppelte Positionsvergabe**
   - Schema + DB verhindern Konflikte.
4. **Leerer Kader**
   - `setRoster([], teamId)` löscht sauber alle Zuordnungen.
5. **Captain nicht im Kader**
   - aktuell möglich; fachlich ggf. zusätzlicher Guard (Service oder DB-Trigger).
6. **Trainingszeiten bei nur einem Teammitglied**
   - Ergebnis kann leer sein, da Paarung (`requester_id` + `partner_id`) beide im Team erwartet.

