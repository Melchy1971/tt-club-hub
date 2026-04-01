# Saisonlogik für halbe Saisons – Review & Umsetzung

## 1) Datenmodell-Review

### Ist-Zustand
- Das alte Modell `seasons` (ein Datensatz je „Saison“) ist weiterhin als Referenz in `teams.season_id` und `schedule_matches.season_id` aktiv.
- Parallel existieren bereits `season_cycles` (Saison-Zyklus, z. B. 2025/26) und `season_phases` (Teilabschnitt, z. B. Hinrunde/Rückrunde).
- `season_phase_id` war in `teams` und `schedule_matches` vorhanden, aber nicht verpflichtend.

### Zielbild
- **Trennung von Zyklus und Phase**:
  - `season_cycles` = fachliche Klammer (Jahrgang + Altersgruppe)
  - `season_phases` = operative Ebene für Team-/Spielplan-Zuordnung
- Operative Entitäten (`teams`, `schedule_matches`) referenzieren **verpflichtend** eine `season_phase`.
- `season_id` bleibt zunächst als Kompatibilitäts-/Migrationsanker erhalten, wird aber gegen `season_phase_id` validiert.

## 2) Constraints

In der neuen Migration umgesetzt:

1. **Pflichtreferenz auf Saisonphase**
   - `teams.season_phase_id` = `NOT NULL`
   - `schedule_matches.season_phase_id` = `NOT NULL`

2. **Maximalphasen & Eindeutigkeit**
   - `UNIQUE (season_cycle_id, phase_type)` auf `season_phases`
   - `UNIQUE` auf aktive Phase je Zyklus (`WHERE is_active = true`)

3. **Regeln nach Altersgruppe**
   - Erwachsene (`herren`, `damen`, `senioren`, `seniorinnen`): nur `first_half`/`second_half`, max. 2
   - Jugend: nur `single_half`, max. 1
   - Validierung als **deferrable constraint trigger**, damit Mehrfach-Änderungen in einer Transaktion möglich bleiben.

4. **Vollständigkeit bei Aktivierung eines Zyklus**
   - `season_cycles.is_active = true` nur erlaubt, wenn:
     - Erwachsene: exakt `first_half` + `second_half`
     - Jugend: exakt eine `single_half`

5. **Referenzkonsistenz alt/neu**
   - Trigger prüft in `teams` und `schedule_matches`:
     - `season_phase_id -> season_cycle_id`
     - `season_id` muss diesem `season_cycle_id` entsprechen

## 3) Service-API (Anpassung)

### Teams
- Filter erweitert: `season_phase_id`
- Service kann nun teams phasenbasiert lesen (`teamService.list({ season_phase_id })`).

### Schedule Matches
- `ScheduleMatchUI` erweitert um `seasonPhaseId`
- Filter erweitert: `season_phase_id`
- click-TT-Import normalisiert jetzt mit `season_phase_id`
- Duplikatprüfung im Import phasenbasiert (`team_id + season_phase_id + match_day`)

## 4) Migrationshinweise (vom bisherigen season-Modell)

### Empfohlene Reihenfolge
1. Bestehende Datensätze mit `season_phase_id` vollständig befüllen (ist bereits in früherer Migration angelegt).
2. Neue Constraints aktivieren (diese Migration).
3. Frontend-/Service-Calls auf `season_phase_id` umstellen.
4. Nach Stabilisierung: `season_id` in operativen Flows als read-only/legacy behandeln.
5. In einem späteren Cutover optional:
   - `season_id` aus `teams`/`schedule_matches` entfernen,
   - oder durch generated/reference view ersetzen.

### Backward Compatibility
- Solange `season_id` noch existiert, verhindert der Konsistenz-Trigger Divergenzen.
- Dadurch kann die Umstellung inkrementell erfolgen, ohne Dateninkonsistenz.

## 5) Edge Cases

1. **Teilweise angelegte Erwachsenen-Saison**
   - Nur `first_half` angelegt: erlaubt als Draft.
   - Aktivierung des Zyklus blockiert, bis `second_half` ergänzt ist.

2. **Ungültiger Mix bei Jugend**
   - `first_half`/`second_half` auf Jugend-Zyklus wird sofort abgelehnt.

3. **Zwei aktive Phasen im selben Zyklus**
   - Durch partial unique index verhindert.

4. **Falsche Kombination aus `season_id` und `season_phase_id`**
   - Insert/Update auf `teams` oder `schedule_matches` schlägt fehl.

5. **Mehrere Phase-Änderungen in einem Save-Vorgang**
   - Deferrable Trigger validiert am Transaktionsende, daher robust bei Batch-Operationen.
