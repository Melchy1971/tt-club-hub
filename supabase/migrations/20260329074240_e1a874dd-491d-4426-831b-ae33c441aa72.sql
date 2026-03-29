
-- Verfügbarkeit pro Spieler und Spiel
CREATE TABLE public.match_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.schedule_matches(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'unknown' CHECK (status IN ('available', 'unavailable', 'maybe', 'unknown')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, member_id)
);

ALTER TABLE public.match_availability ENABLE ROW LEVEL SECURITY;

-- Alle auth. Nutzer dürfen lesen
CREATE POLICY "match_availability_select" ON public.match_availability
  FOR SELECT TO authenticated USING (true);

-- Trainer/Vorstand/Admin dürfen schreiben
CREATE POLICY "match_availability_insert" ON public.match_availability
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vorstand'::app_role)
    OR has_role(auth.uid(), 'trainer'::app_role)
  );

CREATE POLICY "match_availability_update" ON public.match_availability
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vorstand'::app_role)
    OR has_role(auth.uid(), 'trainer'::app_role)
  );

CREATE POLICY "match_availability_delete" ON public.match_availability
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vorstand'::app_role)
    OR has_role(auth.uid(), 'trainer'::app_role)
  );

-- Aufstellung pro Spiel
CREATE TABLE public.match_lineup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.schedule_matches(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, member_id)
);

ALTER TABLE public.match_lineup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_lineup_select" ON public.match_lineup
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "match_lineup_insert" ON public.match_lineup
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vorstand'::app_role)
    OR has_role(auth.uid(), 'trainer'::app_role)
  );

CREATE POLICY "match_lineup_update" ON public.match_lineup
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vorstand'::app_role)
    OR has_role(auth.uid(), 'trainer'::app_role)
  );

CREATE POLICY "match_lineup_delete" ON public.match_lineup
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vorstand'::app_role)
    OR has_role(auth.uid(), 'trainer'::app_role)
  );

-- Trigger für updated_at auf match_availability
CREATE TRIGGER update_match_availability_updated_at
  BEFORE UPDATE ON public.match_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
