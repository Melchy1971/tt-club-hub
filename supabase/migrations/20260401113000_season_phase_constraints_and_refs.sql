-- Saisonmodell-Härtung: season_cycle + season_phase sauber trennen

-- 1) season_phase Referenzen für operative Tabellen verpflichtend machen
ALTER TABLE public.teams
  ALTER COLUMN season_phase_id SET NOT NULL;

ALTER TABLE public.schedule_matches
  ALTER COLUMN season_phase_id SET NOT NULL;

-- 2) Eindeutigkeit pro Zyklus/Phase
CREATE UNIQUE INDEX IF NOT EXISTS uq_season_phases_cycle_phase_type
  ON public.season_phases(season_cycle_id, phase_type);

-- Nur eine aktive Phase pro Zyklus
CREATE UNIQUE INDEX IF NOT EXISTS uq_season_phases_one_active_per_cycle
  ON public.season_phases(season_cycle_id)
  WHERE is_active = true;

-- 3) Konsistenz season_id <-> season_phase_id in teams und schedule_matches
CREATE OR REPLACE FUNCTION public.validate_entity_season_phase_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cycle_id UUID;
BEGIN
  SELECT season_cycle_id INTO v_cycle_id
  FROM public.season_phases
  WHERE id = NEW.season_phase_id;

  IF v_cycle_id IS NULL THEN
    RAISE EXCEPTION 'season_phase_id % existiert nicht', NEW.season_phase_id;
  END IF;

  IF NEW.season_id IS DISTINCT FROM v_cycle_id THEN
    RAISE EXCEPTION 'season_id % passt nicht zu season_phase_id % (cycle %)', NEW.season_id, NEW.season_phase_id, v_cycle_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teams_validate_season_phase_consistency ON public.teams;
CREATE TRIGGER trg_teams_validate_season_phase_consistency
  BEFORE INSERT OR UPDATE OF season_id, season_phase_id
  ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_entity_season_phase_consistency();

DROP TRIGGER IF EXISTS trg_schedule_matches_validate_season_phase_consistency ON public.schedule_matches;
CREATE TRIGGER trg_schedule_matches_validate_season_phase_consistency
  BEFORE INSERT OR UPDATE OF season_id, season_phase_id
  ON public.schedule_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_entity_season_phase_consistency();

-- 4) Phasen-Komposition pro Zyklus (adult vs youth)
CREATE OR REPLACE FUNCTION public.validate_cycle_phase_composition(_cycle_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_age_group public.age_group;
  v_is_adult BOOLEAN;
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

  v_is_adult := v_age_group IN ('herren', 'damen', 'senioren', 'seniorinnen');

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

  IF v_is_adult THEN
    IF v_count > 2 THEN
      RAISE EXCEPTION 'Erwachsene-Zyklen dürfen maximal 2 Phasen haben';
    END IF;

    IF v_single_half_count > 0 THEN
      RAISE EXCEPTION 'Erwachsene-Zyklen dürfen keine single_half-Phase enthalten';
    END IF;
  ELSE
    IF v_count > 1 THEN
      RAISE EXCEPTION 'Jugend-Zyklen dürfen maximal 1 Phase haben';
    END IF;

    IF v_first_half_count > 0 OR v_second_half_count > 0 THEN
      RAISE EXCEPTION 'Jugend-Zyklen dürfen nur single_half enthalten';
    END IF;
  END IF;
END;
$$;

-- Deferrable Constraint Trigger erlaubt INSERT/UPDATE in beliebiger Reihenfolge
CREATE OR REPLACE FUNCTION public.trg_validate_cycle_phase_composition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.validate_cycle_phase_composition(OLD.season_cycle_id);
  ELSE
    PERFORM public.validate_cycle_phase_composition(NEW.season_cycle_id);
    IF TG_OP = 'UPDATE' AND OLD.season_cycle_id IS DISTINCT FROM NEW.season_cycle_id THEN
      PERFORM public.validate_cycle_phase_composition(OLD.season_cycle_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS ctrg_validate_cycle_phase_composition ON public.season_phases;
CREATE CONSTRAINT TRIGGER ctrg_validate_cycle_phase_composition
AFTER INSERT OR UPDATE OR DELETE ON public.season_phases
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.trg_validate_cycle_phase_composition();

-- 5) Aktivierung eines Zyklus nur mit vollständiger, gültiger Phase-Definition
CREATE OR REPLACE FUNCTION public.validate_active_cycle_completeness()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_adult BOOLEAN;
  v_count INTEGER;
  v_first_half_count INTEGER;
  v_second_half_count INTEGER;
  v_single_half_count INTEGER;
BEGIN
  IF NEW.is_active = false THEN
    RETURN NEW;
  END IF;

  v_is_adult := NEW.age_group IN ('herren', 'damen', 'senioren', 'seniorinnen');

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

  IF v_is_adult THEN
    IF NOT (v_count = 2 AND v_first_half_count = 1 AND v_second_half_count = 1) THEN
      RAISE EXCEPTION 'Aktive Erwachsene-Zyklen benötigen genau first_half + second_half';
    END IF;
  ELSE
    IF NOT (v_count = 1 AND v_single_half_count = 1) THEN
      RAISE EXCEPTION 'Aktive Jugend-Zyklen benötigen genau eine single_half-Phase';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_active_cycle_completeness ON public.season_cycles;
CREATE TRIGGER trg_validate_active_cycle_completeness
  BEFORE INSERT OR UPDATE OF is_active, age_group
  ON public.season_cycles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_active_cycle_completeness();
