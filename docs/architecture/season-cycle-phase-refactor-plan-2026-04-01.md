# Refactorplan: `seasons` → `season_cycles` + `season_phases`

## 1) Migrationsplan

1. **Struktur einführen (bereits erfolgt)**
   - Tabellen `season_cycles` und `season_phases` anlegen.
   - `phase_type`-Enum (`first_half`, `second_half`, `single_half`) verwenden.
2. **Bestandsdaten migrieren**
   - Alle Datensätze aus `seasons` in `season_cycles` überführen.
   - Pro Zyklus initiale Phase in `season_phases` erzeugen.
   - `teams.season_phase_id` und `schedule_matches.season_phase_id` aus `season_id` befüllen.
3. **Referenzen härten**
   - `teams.season_phase_id` und `schedule_matches.season_phase_id` auf `NOT NULL`.
   - Konsistenz-Trigger `season_id ↔ season_phase_id ↔ season_cycle_id`.
4. **Komposition absichern**
   - Erwachsene: `first_half` + `second_half`.
   - Jugend: genau eine `single_half`.
5. **Service-Queries umstellen**
   - „aktive Saison“ durch „aktive Phase“ ersetzen (`season_phases.is_active = true`).
   - Legacy-Zugriffe (`active_season`) nur noch als Fallback.
6. **Cutover (später)**
   - `season_id` aus operativen Tabellen entfernen, sobald kein Legacy-Flow mehr darauf basiert.

---

## 2) Aktualisierte Typen & Schemas

- `src/schemas/season.schema.ts`
  - Neue Schemas:
    - `seasonCycleCreateSchema` / `seasonCycleUpdateSchema`
    - `seasonPhaseCreateSchema` / `seasonPhaseUpdateSchema`
    - `phaseTypeSchema`
  - Legacy-Aliase `seasonCreateSchema` / `seasonUpdateSchema` bleiben für Backward Compatibility.
- `src/types/domain/season.ts`
  - Neues Domain-Modell mit `SeasonCycle`, `SeasonPhase`, `PhaseType`.
  - Altes `Season`-Modell wurde auf Cycle/Phase-Semantik umgestellt.

---

## 3) Constraints (DB)

Relevante Regeln in `supabase/migrations/20260401113000_season_phase_constraints_and_refs.sql`:

- `teams.season_phase_id` und `schedule_matches.season_phase_id` sind Pflichtfelder.
- `UNIQUE(season_cycle_id, phase_type)` auf `season_phases`.
- Nur eine aktive Phase pro Zyklus (`WHERE is_active = true`).
- Trigger für Konsistenz zwischen `season_id` und `season_phase_id`.
- Deferrable Constraint Trigger für gültige Phasenkombination je Altersklasse.
- Aktivierbarer Zyklus nur bei vollständiger/valider Phasendefinition.

---

## 4) Query-/Service-Anpassungen

- `teamService.list(...)`
  - Neuer Filter `active_phase`.
  - `active_phase=true` nutzt Join auf `season_phases.is_active = true`.
  - `active_season` bleibt als deprecated Fallback erhalten.
- `teamService.getByActiveSeason()`
  - Verhalten auf aktive Phase umgestellt.
- `scheduleService.list(...)`
  - Neuer Filter `active_phase` auf aktive Saisonphase.
- `teamAssignmentService.getByMember(...)`
  - Zusätzliche Filter:
    - `seasonPhaseId`
    - `activePhase`
  - Filterung erfolgt über Team-Subquery inkl. Phase-Join.

---

## 5) Edge Cases

1. **Erwachsene-Zyklus nur mit `first_half` angelegt**
   - Als Draft zulässig, Aktivierung aber geblockt bis `second_half` existiert.
2. **Jugend-Zyklus mit `first_half`/`second_half`**
   - Sofortiger Constraint-Verstoß.
3. **Zwei aktive Phasen in einem Zyklus**
   - Durch partial unique index verhindert.
4. **Mismatch in operativen Datensätzen**
   - `teams`/`schedule_matches` schlagen fehl, wenn `season_id` nicht zum `season_phase_id`-Zyklus passt.
5. **„Aktive Saison“ vs. „aktive Phase“ parallel**
   - Service priorisiert `active_phase`; `active_season` ist nur Legacy-Fallback.
