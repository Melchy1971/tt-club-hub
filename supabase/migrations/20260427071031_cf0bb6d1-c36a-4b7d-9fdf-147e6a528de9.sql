-- season_cycles: tighten read + restrict write to admin/developer
DROP POLICY IF EXISTS "season_cycles_select" ON public.season_cycles;
DROP POLICY IF EXISTS "season_cycles_insert" ON public.season_cycles;
DROP POLICY IF EXISTS "season_cycles_update" ON public.season_cycles;
DROP POLICY IF EXISTS "season_cycles_delete" ON public.season_cycles;

CREATE POLICY "season_cycles_select"
  ON public.season_cycles
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
    OR public.has_role(auth.uid(), 'vorstand')
  );

CREATE POLICY "season_cycles_insert"
  ON public.season_cycles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
  );

CREATE POLICY "season_cycles_update"
  ON public.season_cycles
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
  );

CREATE POLICY "season_cycles_delete"
  ON public.season_cycles
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
  );

-- season_phases: same pattern
DROP POLICY IF EXISTS "season_phases_select" ON public.season_phases;
DROP POLICY IF EXISTS "season_phases_insert" ON public.season_phases;
DROP POLICY IF EXISTS "season_phases_update" ON public.season_phases;
DROP POLICY IF EXISTS "season_phases_delete" ON public.season_phases;

CREATE POLICY "season_phases_select"
  ON public.season_phases
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
    OR public.has_role(auth.uid(), 'vorstand')
  );

CREATE POLICY "season_phases_insert"
  ON public.season_phases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
  );

CREATE POLICY "season_phases_update"
  ON public.season_phases
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
  );

CREATE POLICY "season_phases_delete"
  ON public.season_phases
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
  );