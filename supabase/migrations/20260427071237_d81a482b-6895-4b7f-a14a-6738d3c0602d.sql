-- Audit-Tabelle für Konsistenz-Läufe
CREATE TABLE public.permission_consistency_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  is_consistent boolean NOT NULL,
  issue_count integer NOT NULL DEFAULT 0,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  triggered_by text NOT NULL DEFAULT 'cron'
);

CREATE INDEX idx_perm_consistency_audit_module_time
  ON public.permission_consistency_audit (module, checked_at DESC);

ALTER TABLE public.permission_consistency_audit ENABLE ROW LEVEL SECURITY;

-- Nur Admin/Developer dürfen das Audit-Log lesen
CREATE POLICY "perm_consistency_audit_select"
  ON public.permission_consistency_audit
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
  );

-- Inserts kommen ausschließlich aus der SECURITY DEFINER-Funktion / Service-Role.
-- Keine INSERT/UPDATE/DELETE Policies für normale Nutzer => komplett abgeschottet.

-- Konsistenzprüfung: vergleicht Soll- vs. Ist-Zustand für Seasons-Tabellen
CREATE OR REPLACE FUNCTION public.check_seasons_permission_consistency()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues jsonb := '[]'::jsonb;
  v_expected_matrix jsonb := jsonb_build_object(
    'admin',        'write',
    'developer',    'write',
    'vorstand',     'read',
    'trainer',      'none',
    'spieler',      'none',
    'mitglied',     'none',
    'fördermitglied','none'
  );
  v_role text;
  v_expected_level text;
  v_actual_level text;
  v_table text;
  v_tables text[] := ARRAY['season_cycles', 'season_phases'];
  v_policy record;
  v_has_admin boolean;
  v_has_developer boolean;
  v_has_vorstand boolean;
  v_qual text;
BEGIN
  -- 1) Permission-Matrix prüfen (role_module_permissions, module='seasons')
  FOR v_role, v_expected_level IN
    SELECT key, value::text FROM jsonb_each_text(v_expected_matrix)
  LOOP
    SELECT lower(level::text) INTO v_actual_level
    FROM public.role_module_permissions
    WHERE module = 'seasons' AND role = v_role;

    IF v_actual_level IS NULL THEN
      v_issues := v_issues || jsonb_build_object(
        'kind', 'matrix_missing',
        'role', v_role,
        'expected', v_expected_level,
        'actual', null
      );
    ELSIF v_actual_level <> v_expected_level THEN
      v_issues := v_issues || jsonb_build_object(
        'kind', 'matrix_mismatch',
        'role', v_role,
        'expected', v_expected_level,
        'actual', v_actual_level
      );
    END IF;
  END LOOP;

  -- 2) RLS-Policies prüfen für season_cycles und season_phases
  FOREACH v_table IN ARRAY v_tables LOOP
    -- RLS muss aktiviert sein
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = v_table AND c.relrowsecurity
    ) THEN
      v_issues := v_issues || jsonb_build_object(
        'kind', 'rls_disabled',
        'table', v_table
      );
    END IF;

    -- Pro Command (SELECT/INSERT/UPDATE/DELETE) Soll-Rollen prüfen
    FOR v_policy IN
      SELECT cmd, lower(coalesce(qual, with_check, '')) AS expr
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = v_table
    LOOP
      v_qual := v_policy.expr;
      v_has_admin := v_qual LIKE '%''admin''%';
      v_has_developer := v_qual LIKE '%''developer''%';
      v_has_vorstand := v_qual LIKE '%''vorstand''%';

      IF v_policy.cmd = 'SELECT' THEN
        -- Lesen: admin + developer + vorstand erforderlich, keine weiteren rollen
        IF NOT (v_has_admin AND v_has_developer AND v_has_vorstand) THEN
          v_issues := v_issues || jsonb_build_object(
            'kind', 'rls_select_missing_role',
            'table', v_table,
            'expected', 'admin+developer+vorstand',
            'expression', v_qual
          );
        END IF;
        IF v_qual LIKE '%''trainer''%' OR v_qual LIKE '%''spieler''%'
           OR v_qual LIKE '%''mitglied''%' OR v_qual LIKE '%''fördermitglied''%' THEN
          v_issues := v_issues || jsonb_build_object(
            'kind', 'rls_select_too_broad',
            'table', v_table,
            'expression', v_qual
          );
        END IF;
        -- Offene 'true'-Policy ist nicht erlaubt
        IF btrim(v_qual) = 'true' THEN
          v_issues := v_issues || jsonb_build_object(
            'kind', 'rls_select_open',
            'table', v_table
          );
        END IF;
      ELSE
        -- INSERT/UPDATE/DELETE: nur admin + developer
        IF NOT (v_has_admin AND v_has_developer) THEN
          v_issues := v_issues || jsonb_build_object(
            'kind', 'rls_write_missing_role',
            'table', v_table,
            'cmd', v_policy.cmd,
            'expected', 'admin+developer',
            'expression', v_qual
          );
        END IF;
        IF v_has_vorstand OR v_qual LIKE '%''trainer''%' OR v_qual LIKE '%''spieler''%' THEN
          v_issues := v_issues || jsonb_build_object(
            'kind', 'rls_write_too_broad',
            'table', v_table,
            'cmd', v_policy.cmd,
            'expression', v_qual
          );
        END IF;
        -- is_admin_or_board() erlaubt vorstand implizit -> verboten
        IF v_qual LIKE '%is_admin_or_board%' THEN
          v_issues := v_issues || jsonb_build_object(
            'kind', 'rls_write_uses_board_helper',
            'table', v_table,
            'cmd', v_policy.cmd,
            'expression', v_qual
          );
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'module', 'seasons',
    'is_consistent', jsonb_array_length(v_issues) = 0,
    'issue_count', jsonb_array_length(v_issues),
    'issues', v_issues
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_seasons_permission_consistency() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_seasons_permission_consistency() TO authenticated, service_role;