CREATE OR REPLACE FUNCTION public.admin_restore_table(
  _table text,
  _rows jsonb,
  _truncate boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed text[] := ARRAY[
    'members','teams','seasons','season_cycles','season_phases',
    'schedule_matches','venues','news','training_bookings',
    'team_members','team_training_slots','board_members','meetings',
    'documents','communication_lists','communication_list_members',
    'match_availability','match_lineup','substitute_requests',
    'member_roles','club_settings','roles','role_module_permissions'
  ];
  v_count integer := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer')) THEN
    RAISE EXCEPTION 'Nicht autorisiert';
  END IF;

  IF NOT (_table = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Tabelle % nicht für Restore erlaubt', _table;
  END IF;

  IF _rows IS NULL OR jsonb_typeof(_rows) <> 'array' THEN
    RAISE EXCEPTION 'Ungültige Datensätze (Array erwartet)';
  END IF;

  IF _truncate THEN
    EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', _table);
  END IF;

  EXECUTE format(
    'INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(NULL::public.%I, $1) ON CONFLICT DO NOTHING',
    _table, _table
  ) USING _rows;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_restore_table(text, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_restore_table(text, jsonb, boolean) TO authenticated;