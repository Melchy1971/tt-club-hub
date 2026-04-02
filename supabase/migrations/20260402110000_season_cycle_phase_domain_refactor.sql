-- Saison-Domain-Refactor: season_cycle + season_phase als führendes Modell

-- 1) Hilfsfunktion: fachliche Gruppierung der Altersklasse
CREATE OR REPLACE FUNCTION public.age_group_audience(v_age_group public.age_group)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN v_age_group IN ('herren', 'damen', 'senioren', 'seniorinnen') THEN 'erwachsene'
    ELSE 'jugend'
  END;
$$;

-- 2) Zulässige phase_type je age_group / Zyklus
CREATE OR REPLACE FUNCTION public.validate_cycle_phase_composition(_cycle_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_age_group public.age_group;
  v_audience text;
  v_count INTEGER;
  v_first_half_count INTEGER;
  v_second_half_count INTEGER;
  v_single_half_count INTEGER;
BEGIN
  SELECT age_group INTO v_age_group
  FROM public.season_cycles
  WHERE id = _cycle_id;

  IF v_age_group IS NULL THEN
    RAISE EXCEPTION 'season_cycle % nicht gefunden', _cycle_id;
  END IF;

  v_audience := public.age_group_audience(v_age_group);

  SELECT COUNT(*) INTO v_count
  FROM public.season_phases
  WHERE season_cycle_id = _cycle_id;

  SELECT COUNT(*) INTO v_first_half_count
  FROM public.season_phases
  WHERE season_cycle_id = _cycle_id AND phase_type = 'first_half';

  SELECT COUNT(*) INTO v_second_half_count
  FROM public.season_phases
  WHERE season_cycle_id = _cycle_id AND phase_type = 'second_half';

  SELECT COUNT(*) INTO v_single_half_count
  FROM public.season_phases
  WHERE season_cycle_id = _cycle_id AND phase_type = 'single_half';

  IF v_audience = 'erwachsene' THEN
    -- Draft-Zyklus ohne Phase ist erlaubt
    IF v_count = 0 THEN
      RETURN;
    END IF;

    IF v_single_half_count > 0 THEN
      RAISE EXCEPTION 'Erwachsene-Zyklen dürfen keine single_half-Phase enthalten';
    END IF;

    IF v_first_half_count <> 1 THEN
      RAISE EXCEPTION 'Erwachsene-Zyklen benötigen genau eine first_half-Phase';
    END IF;

    IF v_second_half_count > 1 THEN
      RAISE EXCEPTION 'Erwachsene-Zyklen dürfen maximal eine second_half-Phase enthalten';
    END IF;

    IF v_count NOT IN (1, 2) THEN
      RAISE EXCEPTION 'Erwachsene-Zyklen dürfen nur first_half und optional second_half enthalten';
    END IF;
  ELSE
    -- Draft-Zyklus ohne Phase ist erlaubt
    IF v_count = 0 THEN
      RETURN;
    END IF;

    IF NOT (v_count = 1 AND v_single_half_count = 1) THEN
      RAISE EXCEPTION 'Jugend-Zyklen benötigen genau eine single_half-Phase';
    END IF;

    IF v_first_half_count > 0 OR v_second_half_count > 0 THEN
      RAISE EXCEPTION 'Jugend-Zyklen dürfen keine first_half/second_half-Phasen enthalten';
    END IF;
  END IF;
END;
$$;

-- 3) Aktive Zyklen: Erwachsene mit first_half (+ optional second_half), Jugend mit single_half
CREATE OR REPLACE FUNCTION public.validate_active_cycle_completeness()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_audience text;
  v_count INTEGER;
  v_first_half_count INTEGER;
  v_second_half_count INTEGER;
  v_single_half_count INTEGER;
BEGIN
  IF NEW.is_active = false THEN
    RETURN NEW;
  END IF;

  v_audience := public.age_group_audience(NEW.age_group);

  SELECT COUNT(*) INTO v_count
  FROM public.season_phases
  WHERE season_cycle_id = NEW.id;

  SELECT COUNT(*) INTO v_first_half_count
  FROM public.season_phases
  WHERE season_cycle_id = NEW.id AND phase_type = 'first_half';

  SELECT COUNT(*) INTO v_second_half_count
  FROM public.season_phases
  WHERE season_cycle_id = NEW.id AND phase_type = 'second_half';

  SELECT COUNT(*) INTO v_single_half_count
  FROM public.season_phases
  WHERE season_cycle_id = NEW.id AND phase_type = 'single_half';

  IF v_audience = 'erwachsene' THEN
    IF NOT (
      v_first_half_count = 1
      AND v_second_half_count IN (0, 1)
      AND v_single_half_count = 0
      AND v_count IN (1, 2)
    ) THEN
      RAISE EXCEPTION 'Aktive Erwachsene-Zyklen benötigen first_half und optional second_half';
    END IF;
  ELSE
    IF NOT (v_count = 1 AND v_single_half_count = 1) THEN
      RAISE EXCEPTION 'Aktive Jugend-Zyklen benötigen genau eine single_half-Phase';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Sortierung/Filterung absichern (season_phase-basiert)
CREATE INDEX IF NOT EXISTS idx_season_phases_cycle_sort_start
  ON public.season_phases(season_cycle_id, sort_order, start_date, id);

CREATE INDEX IF NOT EXISTS idx_teams_phase_active_name
  ON public.teams(season_phase_id, is_active, name);

CREATE INDEX IF NOT EXISTS idx_schedule_matches_phase_date
  ON public.schedule_matches(season_phase_id, match_date, match_time);
