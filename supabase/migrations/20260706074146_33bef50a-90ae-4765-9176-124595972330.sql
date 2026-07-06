CREATE OR REPLACE FUNCTION public.admin_wipe_all_data()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer')) THEN
    RAISE EXCEPTION 'Nicht autorisiert';
  END IF;

  TRUNCATE TABLE
    public.match_lineup,
    public.match_availability,
    public.substitute_requests,
    public.schedule_matches,
    public.training_bookings,
    public.team_training_slots,
    public.team_members,
    public.teams,
    public.communication_list_members,
    public.communication_lists,
    public.meeting_documents,
    public.meetings,
    public.documents,
    public.news,
    public.board_members,
    public.consent_audit_log,
    public.member_consents,
    public.deletion_requests,
    public.member_roles,
    public.members,
    public.venues,
    public.season_phases,
    public.season_cycles,
    public.seasons,
    public.club_settings
  RESTART IDENTITY CASCADE;
END;
$function$;