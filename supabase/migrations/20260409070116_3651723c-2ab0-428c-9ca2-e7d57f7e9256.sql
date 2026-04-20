
-- Tabelle für wiederkehrende Team-Trainingsslots
CREATE TABLE public.team_training_slots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  weekday    smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time   time NOT NULL,
  location   text,
  is_active  boolean NOT NULL DEFAULT true,
  valid_from date,
  valid_to   date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_slot_times CHECK (end_time > start_time)
);

-- Trigger: Validierung valid_to >= valid_from
CREATE OR REPLACE FUNCTION public.validate_training_slot_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.valid_to IS NOT NULL AND NEW.valid_from IS NOT NULL AND NEW.valid_to < NEW.valid_from THEN
    RAISE EXCEPTION 'valid_to muss >= valid_from sein';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_training_slot_dates
  BEFORE INSERT OR UPDATE ON public.team_training_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_training_slot_dates();

-- updated_at Trigger
CREATE TRIGGER update_team_training_slots_updated_at
  BEFORE UPDATE ON public.team_training_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indizes
CREATE INDEX idx_team_training_slots_team_weekday ON public.team_training_slots (team_id, weekday);
CREATE INDEX idx_team_training_slots_team_active ON public.team_training_slots (team_id, is_active);

-- RLS
ALTER TABLE public.team_training_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_training_slots_select"
  ON public.team_training_slots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "team_training_slots_insert"
  ON public.team_training_slots FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vorstand'::app_role)
    OR has_role(auth.uid(), 'trainer'::app_role)
  );

CREATE POLICY "team_training_slots_update"
  ON public.team_training_slots FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vorstand'::app_role)
    OR has_role(auth.uid(), 'trainer'::app_role)
  );

CREATE POLICY "team_training_slots_delete"
  ON public.team_training_slots FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vorstand'::app_role)
    OR has_role(auth.uid(), 'trainer'::app_role)
  );
