# Verfügbarkeits- und Aufstellungslogik für Spiele

## Datenmodell

### `match_player_availability`
- Zweck: Verfügbarkeit pro Spieler und Spiel (`match_id + member_id` eindeutig).
- Status: `available`, `unavailable`, `unknown`.
- `team_id` ist denormalisiert für schnelle Teamabfragen.
- `updated_by` dokumentiert, wer den Status gesetzt hat.

### `match_lineups`
- Zweck: konkrete Aufstellung pro Spiel, getrennt von Verfügbarkeit.
- Eindeutigkeiten:
  - `UNIQUE(match_id, position)`
  - `UNIQUE(match_id, member_id)`
- `is_substitute` erlaubt Ersatzspieler ohne Vermischung mit Availability.

## Service-API

### `availabilityService`
- `getForMatch(matchId)`
- `setStatus({ match_id, team_id, member_id, status, note })`
- `bulkSet({ match_id, team_id, entries[] })`
- `remove(matchId, memberId)`
- Vor jedem Write: Validierung von Team/Phase/Zuordnung.

### `lineupService`
- `getForMatch(matchId)`
- `setLineup({ match_id, team_id, entries[] })`
- `removePlayer(matchId, memberId)`
- Vor jedem Write: Konflikterkennung + Team/Phase-Prüfung.

## Validierungsregeln

DB-seitig (Trigger + Funktionen):
1. `schedule_matches.team_id` muss zu Payload-`team_id` passen.
2. Team muss aktiv sein (`teams.is_active = true`).
3. Team und Match müssen dieselbe `season_phase_id` haben.
4. Spieler muss in `team_members` dieser Mannschaft vorkommen.
5. Inaktive Mitglieder (`members.is_active = false`) sind unzulässig.
6. Bei Spiel-Änderung (`team_id`, `season_phase_id`) werden bestehende Availability- und Lineup-Einträge revalidiert.

Service-seitig (vor Upsert/Insert):
- Konflikte werden explizit erkannt und als strukturierte Fehler geliefert:
  - `duplicate_member`
  - `duplicate_position` (Lineup)
  - `wrong_team`
  - `inactive_assignment`
  - `missing_assignment`

## Rollen & Berechtigungen

- Schreiben auf `match_player_availability` und `match_lineups` nur mit Rolle:
  - `trainer`
  - `vorstand`
  - `admin`
- Gesteuert über RLS-Policies (`USING` + `WITH CHECK`).

## Edge Cases

### Teamwechsel (Spieler wechselt Mannschaft)
- Neue Zuordnung wirkt nur für neue Einträge.
- Bestehende Einträge werden bei Match-Update auf Team/Phase erneut validiert.
- Falsche historische Zuordnungen werden beim nächsten Write blockiert.

### Saisonwechsel / Phasewechsel
- Einträge sind nur gültig, wenn Team und Spiel in derselben `season_phase_id` liegen.
- Verhindert „Mitnahme“ von Aufstellungen in andere Saisonphasen.

### Spielverschiebung
- Reine Datums-/Zeitverschiebung beeinflusst Gültigkeit nicht.
- Wenn bei Verschiebung auch `team_id` oder `season_phase_id` geändert wird, greift Revalidierung aller vorhandenen Availability- und Lineup-Einträge.

## Ergebniseingabe

Pro Spiel können Ergebnisse über `home_score` und `away_score` in der Tabelle `schedule_matches` erfasst werden. Nach TT-Regeln beträgt das Maximalergebnis 9:9. Die Ergebniseingabe ist für Admin, Vorstand und Trainer freigeschaltet.

## Tabelle / Standings

Der Bereich „Tabelle" unter Sportbetrieb zeigt alle aktiven Mannschaften mit ihrem Liga-Badge und einem Link zur jeweiligen Click-TT Tabelle (Feld `clicktt_url` in der Tabelle `teams`). Es wird keine eigene Tabelle auf Basis der Spielergebnisse berechnet – stattdessen wird auf die offizielle Click-TT Tabelle verlinkt.
