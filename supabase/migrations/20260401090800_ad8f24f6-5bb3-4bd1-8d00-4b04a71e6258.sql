
-- 1. Create phase_type enum
CREATE TYPE public.phase_type AS ENUM ('first_half', 'second_half', 'single_half');

-- 2. Create season_cycles table
CREATE TABLE public.season_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_year INTEGER NOT NULL,
  end_year INTEGER NOT NULL,
  age_group public.age_group NOT NULL DEFAULT 'herren',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create season_phases table
CREATE TABLE public.season_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_cycle_id UUID NOT NULL REFERENCES public.season_cycles(id) ON DELETE CASCADE,
  phase_type public.phase_type NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Indexes
CREATE INDEX idx_season_cycles_active ON public.season_cycles (is_active) WHERE is_active = true;
CREATE INDEX idx_season_phases_cycle ON public.season_phases (season_cycle_id);
CREATE INDEX idx_season_phases_active ON public.season_phases (is_active) WHERE is_active = true;

-- 5. updated_at triggers
CREATE TRIGGER set_season_cycles_updated_at
  BEFORE UPDATE ON public.season_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_season_phases_updated_at
  BEFORE UPDATE ON public.season_phases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Validation trigger: enforce phase_type rules per age_group
CREATE OR REPLACE FUNCTION public.validate_season_phase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_age_group public.age_group;
  v_phase_count INTEGER;
  v_is_adult BOOLEAN;
BEGIN
  SELECT age_group INTO v_age_group
  FROM public.season_cycles WHERE id = NEW.season_cycle_id;

  v_is_adult := v_age_group IN ('herren', 'damen', 'senioren', 'seniorinnen');

  -- Check phase_type matches age_group category
  IF v_is_adult AND NEW.phase_type = 'single_half' THEN
    RAISE EXCEPTION 'Erwachsene-Zyklen erlauben nur first_half oder second_half';
  END IF;

  IF NOT v_is_adult AND NEW.phase_type IN ('first_half', 'second_half') THEN
    RAISE EXCEPTION 'Jugend-Zyklen erlauben nur single_half';
  END IF;

  -- Check max phase count
  SELECT COUNT(*) INTO v_phase_count
  FROM public.season_phases
  WHERE season_cycle_id = NEW.season_cycle_id
    AND (TG_OP = 'INSERT' OR id != NEW.id);

  IF v_is_adult AND v_phase_count >= 2 THEN
    RAISE EXCEPTION 'Erwachsene-Zyklen können maximal 2 Phasen haben';
  END IF;

  IF NOT v_is_adult AND v_phase_count >= 1 THEN
    RAISE EXCEPTION 'Jugend-Zyklen können maximal 1 Phase haben';
  END IF;

  -- Validate dates
  IF NEW.start_date >= NEW.end_date THEN
    RAISE EXCEPTION 'Startdatum muss vor dem Enddatum liegen';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_season_phase
  BEFORE INSERT OR UPDATE ON public.season_phases
  FOR EACH ROW EXECUTE FUNCTION public.validate_season_phase();

-- 7. Migrate existing seasons data
INSERT INTO public.season_cycles (id, name, start_year, end_year, age_group, is_active, created_at, updated_at)
SELECT
  id,
  name,
  EXTRACT(YEAR FROM start_date)::INTEGER,
  EXTRACT(YEAR FROM end_date)::INTEGER,
  age_group,
  is_current,
  created_at,
  updated_at
FROM public.seasons;

INSERT INTO public.season_phases (id, season_cycle_id, phase_type, name, start_date, end_date, is_active, sort_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  id,
  CASE
    WHEN age_group IN ('herren', 'damen', 'senioren', 'seniorinnen') THEN 'first_half'::public.phase_type
    ELSE 'single_half'::public.phase_type
  END,
  name,
  start_date,
  end_date,
  is_current,
  1,
  created_at,
  updated_at
FROM public.seasons;

-- 8. Add season_phase_id to teams and schedule_matches
ALTER TABLE public.teams ADD COLUMN season_phase_id UUID REFERENCES public.season_phases(id);
ALTER TABLE public.schedule_matches ADD COLUMN season_phase_id UUID REFERENCES public.season_phases(id);

-- 9. Populate season_phase_id from existing season_id
UPDATE public.teams t
SET season_phase_id = sp.id
FROM public.season_phases sp
JOIN public.season_cycles sc ON sc.id = sp.season_cycle_id
WHERE t.season_id = sc.id;

UPDATE public.schedule_matches sm
SET season_phase_id = sp.id
FROM public.season_phases sp
JOIN public.season_cycles sc ON sc.id = sp.season_cycle_id
WHERE sm.season_id = sc.id;

-- 10. Enable RLS
ALTER TABLE public.season_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_phases ENABLE ROW LEVEL SECURITY;

-- RLS for season_cycles
CREATE POLICY "season_cycles_select" ON public.season_cycles FOR SELECT TO authenticated USING (true);
CREATE POLICY "season_cycles_insert" ON public.season_cycles FOR INSERT TO authenticated WITH CHECK (is_admin_or_board(auth.uid()));
CREATE POLICY "season_cycles_update" ON public.season_cycles FOR UPDATE TO authenticated USING (is_admin_or_board(auth.uid()));
CREATE POLICY "season_cycles_delete" ON public.season_cycles FOR DELETE TO authenticated USING (is_admin_or_board(auth.uid()));

-- RLS for season_phases
CREATE POLICY "season_phases_select" ON public.season_phases FOR SELECT TO authenticated USING (true);
CREATE POLICY "season_phases_insert" ON public.season_phases FOR INSERT TO authenticated WITH CHECK (is_admin_or_board(auth.uid()));
CREATE POLICY "season_phases_update" ON public.season_phases FOR UPDATE TO authenticated USING (is_admin_or_board(auth.uid()));
CREATE POLICY "season_phases_delete" ON public.season_phases FOR DELETE TO authenticated USING (is_admin_or_board(auth.uid()));

-- 11. Enable realtime for both new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.season_cycles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.season_phases;
