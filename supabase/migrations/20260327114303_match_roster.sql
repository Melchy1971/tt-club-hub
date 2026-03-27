-- Match availabilities & lineups

-- === match_availabilities ===
CREATE TABLE public.match_availabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.schedule_matches(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('available','maybe','unavailable')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, member_id)
);

CREATE INDEX idx_match_avail_match ON public.match_availabilities(match_id);
CREATE INDEX idx_match_avail_member ON public.match_availabilities(member_id);

CREATE TRIGGER update_match_avail_updated_at
  BEFORE UPDATE ON public.match_availabilities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.match_availabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_avail_select_all_auth"
  ON public.match_availabilities FOR SELECT TO authenticated USING (true);

CREATE POLICY "match_avail_write_staff"
  ON public.match_availabilities FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
    OR public.has_role(auth.uid(), 'vorstand')
    OR public.has_role(auth.uid(), 'trainer')
  );

CREATE POLICY "match_avail_update_staff"
  ON public.match_availabilities FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
    OR public.has_role(auth.uid(), 'vorstand')
    OR public.has_role(auth.uid(), 'trainer')
  );

CREATE POLICY "match_avail_delete_staff"
  ON public.match_availabilities FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
    OR public.has_role(auth.uid(), 'vorstand')
    OR public.has_role(auth.uid(), 'trainer')
  );

-- === match_lineups ===
CREATE TABLE public.match_lineups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.schedule_matches(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0),
  is_substitute BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, position),
  UNIQUE (match_id, member_id)
);

CREATE INDEX idx_match_lineups_match ON public.match_lineups(match_id);
CREATE INDEX idx_match_lineups_member ON public.match_lineups(member_id);

CREATE TRIGGER update_match_lineups_updated_at
  BEFORE UPDATE ON public.match_lineups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.match_lineups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_lineups_select_all_auth"
  ON public.match_lineups FOR SELECT TO authenticated USING (true);

CREATE POLICY "match_lineups_write_staff"
  ON public.match_lineups FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
    OR public.has_role(auth.uid(), 'vorstand')
    OR public.has_role(auth.uid(), 'trainer')
  );

CREATE POLICY "match_lineups_update_staff"
  ON public.match_lineups FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
    OR public.has_role(auth.uid(), 'vorstand')
    OR public.has_role(auth.uid(), 'trainer')
  );

CREATE POLICY "match_lineups_delete_staff"
  ON public.match_lineups FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
    OR public.has_role(auth.uid(), 'vorstand')
    OR public.has_role(auth.uid(), 'trainer')
  );
