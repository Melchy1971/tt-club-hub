# Team-Domain Blueprint mit `season_phase`-Bezug (2026-04-02)

## Zielbild

Die Team-Domain wird **phase-first** modelliert:

- `teams` enthält Stammdaten pro Saisonphase (`season_phase_id` als führende Referenz).
- `team_members` bleibt die **technische aktuelle Kaderabbildung** (Position im Team).
- `member_team_assignments` wird als **fachliche Historien-/Lebenszyklus-Sicht** etabliert (aktiv vs. historisch).

Damit werden Team-CRUD, Zuordnungs-Lebenszyklus und Saisonschnitt sauber entkoppelt.

---

## 1) Typen

### Kernentitäten

- `Team`
  - Pflicht: `id`, `name`, `season_phase_id`, `season_cycle_id`
  - Fachfelder: `league`, `division`, `age_group`, `captain_id`, `is_active`
- `TeamMember`
  - technisch-operativ: `team_id`, `member_id`, `position`
  - Fokus: aktueller Kaderzustand
- `MemberTeamAssignment`
  - fachlich: `team_id`, `member_id`, `season_phase_id`, `season_cycle_id`, `position`, `is_captain`
  - Lebenszyklus: `status` (`active` | `historical`), `valid_from`, `valid_to`
  - optionaler Teamkontext für Ratings: `ratings.ttr_rating`, `ratings.qttr_rating`

### Modellierung „Position, Kapitän, Liga, Trainingszeiten"

- Position: weiterhin in `team_members.position` (Unique pro Team).
- Kapitän: weiterhin in `teams.captain_id` (optional zusätzlich fachlich in Assignments gespiegelt).
- Liga: weiterhin in `teams.league`.
- Trainingszeiten: bleiben in `training_bookings`; Teamkontext wird über aktive Teamzuordnungen ermittelt.

---

## 2) Service-API

### `teamService` (CRUD + Phase-Fokus)

- `list({ season_phase_id?, season_cycle_id?, active_phase?, is_active? })`
- `getById(teamId)`
- `getWithRoster(teamId)`
- `create(input)`
  - `season_phase_id` ist führend
  - `season_cycle_id`/`season_id` werden bei Bedarf aus der Phase aufgelöst
- `update(teamId, patch)`
  - bei Phase-Wechsel automatische Zyklus-Synchronisierung
- `remove(teamId)`
- `listOverview(filters)`

### `teamAssignmentService` (Mitglied-zu-Team)

- `getByTeam(teamId)` → aktueller Kader
- `assign(teamId, memberId, position)`
- `unassign(teamId, memberId)`
- `swapPositions(teamId, memberId1, memberId2)`
- `setRoster(teamId, entries)`
- `getMemberTeamAssignments(memberId, options)`
  - `options.seasonPhaseId?`
  - `options.activePhase?`
  - `options.includeHistorical?` (API vorbereitet, DB-Historie optional nachziehbar)
  - `options.includeRatings?` (QTTR/TTR im Teamkontext optional)

### Abgrenzung `team_members` vs. `member_team_assignments`

- `team_members`
  - schnelle, constraints-starke **Ist-Zuordnung** für operative Use-Cases (Aufstellung, Teamseite).
- `member_team_assignments`
  - fachliche Sicht inklusive Historie und Gültigkeitsintervallen.
  - kann als Tabelle oder View/RPC geliefert werden.

---

## 3) Migrationshinweise

### A) Minimal-invasiv (empfohlen als Schritt 1)

1. **Keine Breaking-Änderung** an `team_members`.
2. Einführung einer fachlichen Historienstruktur:
   - neue Tabelle `member_team_assignments` **oder** View + Event-Trigger.
3. Backfill aus aktuellem `team_members`:
   - aktive Datensätze mit `status = 'active'`, `valid_from = now()`, `valid_to = null`.
4. Service schrittweise umstellen:
   - Reads für Historie über neue Struktur,
   - operative Writes zunächst weiterhin gegen `team_members`.

### B) Vollständig fachlich (Schritt 2)

1. Writes über Transaktion/RPC:
   - beim Teamwechsel: alten aktiven Assignment-Datensatz schließen (`valid_to` setzen), neuen öffnen.
2. Optional: `team_members` als materialisierte Projektion aus aktiven Assignments erzeugen.
3. Zusätzliche Constraints:
   - max. ein aktives Assignment je `(member_id, season_phase_id)`
   - nur ein Kapitän je Team (falls gewünscht DB-seitig erzwingen)

### C) QTTR/TTR im Teamkontext

- Keine Pflichtspalten nötig.
- Optional:
  - Snapshot-Felder in Assignments (`ttr_rating_snapshot`, `qttr_rating_snapshot`) für historische Auswertungen,
  - oder rein dynamisch aus `members` joinen (aktueller Stand).

---

## 4) Edge Cases

### Saisonwechsel

1. **Phase wird archiviert, neue Phase aktiv**
   - Teams können kopiert oder neu angelegt werden.
   - aktive Assignments der alten Phase müssen sauber auf `historical`/`valid_to` gesetzt werden.
2. **Mitglied ohne neue Zuordnung in neuer Phase**
   - darf nicht implizit „aktiv" bleiben.
3. **Kapitän in alter Phase, aber nicht in neuer Teamstruktur**
   - `captain_id` validieren und ggf. auf `null` setzen.

### Teamwechsel innerhalb derselben Phase

1. Altes aktives Assignment schließen, neues öffnen (keine zwei aktiven parallel).
2. Positionskonflikte im Zielteam abfangen (`UNIQUE(team_id, position)`).
3. Wechsel auf denselben Teamdatensatz als No-op behandeln.

### Historie und Rückdatierung

1. Rückdatierte Wechsel dürfen keine überlappenden Intervalle erzeugen.
2. `valid_from <= valid_to` erzwingen (wenn `valid_to` gesetzt).

### QTTR/TTR

1. Fehlende Werte (`null`) müssen erlaubt bleiben.
2. Wenn Snapshots aktiviert sind: beim Wechsel Regel definieren, ob alte Werte eingefroren bleiben.

