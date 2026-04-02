# Saison-Domain Refactor: `seasons` → `season_cycles` + `season_phases`

## 1) Refactoring-Plan

1. **Domänenvertrag auf Phase-first umstellen**
   - Operative Reads/Writes in Teams, Team-Zuordnung, Spielplan über `season_phase_id`.
   - `season_id` nur als Legacy-/Redundanzfeld (`season_cycle_id`).
2. **Typen und API konsolidieren**
   - Neue ID-Typen `SeasonCycleId` und `SeasonPhaseId`.
   - Domain-Modelle `Team`, `MemberTeamAssignment`, `Match` mit `season_cycle_id` + `season_phase_id`.
3. **Services erweitern**
   - `seasonCycleService`: aktive Zyklen separat von aktiven Phasen lesen.
   - `seasonPhaseService`: Liste pro Zyklus, sortiert über `sort_order`, dann `start_date`.
4. **DB-Constraints härten**
   - Erwachsene: genau `first_half`, optional `second_half`.
   - Jugend: genau `single_half`.
   - Aktiver Zyklus darf nur mit gültiger Phasenkomposition aktiviert werden.
5. **Migration & Backward-Compatibility**
   - Eingaben erlauben `season_cycle_id` plus deprecated `season_id`.
   - Services mappen `season_cycle_id` intern auf die DB-Spalte `season_id`, bis Spalten-Umbenennung erfolgt.

## 2) Aktualisierte Typen

- `src/types/api.ts`
  - `SeasonCycleId`, `SeasonPhaseId` ergänzt.
- `src/types/domain/team.ts`
  - `season_phase_id` als primäre operative Referenz.
  - `season_cycle_id` ergänzt; `season_id` als deprecated Alias.
- `src/types/domain/match.ts`
  - analog zu Team auf `season_cycle_id` + `season_phase_id`.

## 3) Service-API (`seasonCycle` / `seasonPhase`)

- `seasonCycleService.getActive()`
  - liefert aktiven Zyklus unabhängig von aktiver Phase.
- `seasonCycleService.getActiveWithPhases()`
  - liefert aktiven Zyklus plus sortierte Phasen (`sort_order`, `start_date`).
- `seasonPhaseService.listByCycle(seasonCycleId)`
  - liefert Phasen eines Zyklus sortiert und filterbar pro UI/Import.

## 4) Migrationshinweise

1. **Deploy-Reihenfolge**
   - Zuerst DB-Migration mit Constraints/Indizes.
   - Danach App-Deploy mit `season_cycle_id`-Alias-Mapping.
2. **Kompatibilität**
   - Solange DB-Spalte `season_id` noch existiert, App-seitig `season_cycle_id -> season_id` mappen.
   - Externe Integrationen schrittweise von `season_id` auf `season_cycle_id` umstellen.
3. **Datenqualität prüfen**
   - Pro `season_cycle` sicherstellen:
     - Erwachsene: `first_half` vorhanden, `second_half` max. 1
     - Jugend: nur 1x `single_half`
4. **Sortierung/Filterung**
   - Abfragen pro Phase über neue Indizes:
     - `season_phases(season_cycle_id, sort_order, start_date, id)`
     - `teams(season_phase_id, is_active, name)`
     - `schedule_matches(season_phase_id, match_date, match_time)`

## 5) Edge Cases

### Erwachsene – optionale Rückrunde (`second_half`)

- **Nur Hinrunde vorhanden**: gültig für aktive Zyklen.
- **Rückrunde später ergänzt**: zulässig, solange weiterhin exakt 1x `first_half` und max. 1x `second_half`.
- **Falsche Phase (`single_half`)**: per Constraint blockiert.

### Jugend – Halbrunde (`single_half`)

- **Kein `single_half` bei aktivem Zyklus**: Aktivierung wird verhindert.
- **Zusätzliche `first_half`/`second_half`**: per Constraint blockiert.
- **Mehrere `single_half`-Phasen**: per Constraint blockiert.
