
CREATE OR REPLACE FUNCTION public.admin_wipe_all_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer')) THEN
    RAISE EXCEPTION 'Nicht autorisiert';
  END IF;

  -- Reihenfolge: abhängige Tabellen zuerst
  DELETE FROM public.match_lineup;
  DELETE FROM public.match_availability;
  DELETE FROM public.substitute_requests;
  DELETE FROM public.schedule_matches;
  DELETE FROM public.training_bookings;
  DELETE FROM public.team_training_slots;
  DELETE FROM public.team_members;
  DELETE FROM public.teams;
  DELETE FROM public.communication_list_members;
  DELETE FROM public.communication_lists;
  DELETE FROM public.meeting_documents;
  DELETE FROM public.meetings;
  DELETE FROM public.documents;
  DELETE FROM public.news;
  DELETE FROM public.board_members;
  DELETE FROM public.consent_audit_log;
  DELETE FROM public.member_consents;
  DELETE FROM public.deletion_requests;
  DELETE FROM public.member_roles;
  DELETE FROM public.members;
  DELETE FROM public.venues;
  DELETE FROM public.season_phases;
  DELETE FROM public.season_cycles;
  DELETE FROM public.seasons;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_wipe_all_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_wipe_all_data() TO authenticated;
