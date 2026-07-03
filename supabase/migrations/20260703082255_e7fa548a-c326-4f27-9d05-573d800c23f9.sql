CREATE OR REPLACE FUNCTION public.admin_wipe_all_members()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer')) THEN
    RAISE EXCEPTION 'Nicht autorisiert';
  END IF;

  DELETE FROM public.match_lineup;
  DELETE FROM public.match_availability;
  DELETE FROM public.substitute_requests;
  DELETE FROM public.training_bookings;
  DELETE FROM public.team_members;
  DELETE FROM public.communication_list_members;
  DELETE FROM public.consent_audit_log;
  DELETE FROM public.member_consents;
  DELETE FROM public.deletion_requests;
  DELETE FROM public.board_members;
  DELETE FROM public.member_roles;
  DELETE FROM public.members;
END;
$$;