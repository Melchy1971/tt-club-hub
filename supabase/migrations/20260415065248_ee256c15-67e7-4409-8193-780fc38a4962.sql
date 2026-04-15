
-- STEP 1: DROP ALL POLICIES
DROP POLICY IF EXISTS "Club_settings aktualisierbar für Admin" ON public.club_settings;
DROP POLICY IF EXISTS "Club_settings schreibbar für Admin" ON public.club_settings;
DROP POLICY IF EXISTS "comm_list_members_delete" ON public.communication_list_members;
DROP POLICY IF EXISTS "comm_list_members_insert" ON public.communication_list_members;
DROP POLICY IF EXISTS "comm_lists_delete" ON public.communication_lists;
DROP POLICY IF EXISTS "comm_lists_insert" ON public.communication_lists;
DROP POLICY IF EXISTS "comm_lists_update" ON public.communication_lists;
DROP POLICY IF EXISTS "consent_audit_log_insert" ON public.consent_audit_log;
DROP POLICY IF EXISTS "consent_audit_log_select" ON public.consent_audit_log;
DROP POLICY IF EXISTS "deletion_requests_delete" ON public.deletion_requests;
DROP POLICY IF EXISTS "deletion_requests_insert" ON public.deletion_requests;
DROP POLICY IF EXISTS "deletion_requests_select" ON public.deletion_requests;
DROP POLICY IF EXISTS "deletion_requests_update" ON public.deletion_requests;
DROP POLICY IF EXISTS "documents_delete" ON public.documents;
DROP POLICY IF EXISTS "documents_insert" ON public.documents;
DROP POLICY IF EXISTS "documents_update" ON public.documents;
DROP POLICY IF EXISTS "match_availability_delete" ON public.match_availability;
DROP POLICY IF EXISTS "match_availability_insert" ON public.match_availability;
DROP POLICY IF EXISTS "match_availability_update" ON public.match_availability;
DROP POLICY IF EXISTS "match_lineup_delete" ON public.match_lineup;
DROP POLICY IF EXISTS "match_lineup_insert" ON public.match_lineup;
DROP POLICY IF EXISTS "match_lineup_update" ON public.match_lineup;
DROP POLICY IF EXISTS "meeting_docs_delete" ON public.meeting_documents;
DROP POLICY IF EXISTS "meeting_docs_insert" ON public.meeting_documents;
DROP POLICY IF EXISTS "meeting_docs_select" ON public.meeting_documents;
DROP POLICY IF EXISTS "meetings_delete" ON public.meetings;
DROP POLICY IF EXISTS "meetings_insert" ON public.meetings;
DROP POLICY IF EXISTS "meetings_update" ON public.meetings;
DROP POLICY IF EXISTS "Members aktualisierbar" ON public.members;
DROP POLICY IF EXISTS "Members löschbar für Admin/Vorstand" ON public.members;
DROP POLICY IF EXISTS "Members schreibbar für Admin/Vorstand/Trainer" ON public.members;
DROP POLICY IF EXISTS "member_consents_insert" ON public.member_consents;
DROP POLICY IF EXISTS "member_consents_select" ON public.member_consents;
DROP POLICY IF EXISTS "member_consents_update" ON public.member_consents;
DROP POLICY IF EXISTS "news_delete" ON public.news;
DROP POLICY IF EXISTS "news_insert" ON public.news;
DROP POLICY IF EXISTS "news_update" ON public.news;
DROP POLICY IF EXISTS "role_module_permissions_delete" ON public.role_module_permissions;
DROP POLICY IF EXISTS "role_module_permissions_insert" ON public.role_module_permissions;
DROP POLICY IF EXISTS "role_module_permissions_update" ON public.role_module_permissions;
DROP POLICY IF EXISTS "roles_delete" ON public.roles;
DROP POLICY IF EXISTS "roles_insert" ON public.roles;
DROP POLICY IF EXISTS "roles_update" ON public.roles;
DROP POLICY IF EXISTS "Schedule_matches aktualisierbar für Admin/Vorstand/Trainer" ON public.schedule_matches;
DROP POLICY IF EXISTS "Schedule_matches löschbar für Admin/Vorstand" ON public.schedule_matches;
DROP POLICY IF EXISTS "Schedule_matches schreibbar für Admin/Vorstand/Trainer" ON public.schedule_matches;
DROP POLICY IF EXISTS "Seasons aktualisierbar für Admin/Vorstand" ON public.seasons;
DROP POLICY IF EXISTS "Seasons löschbar für Admin/Vorstand" ON public.seasons;
DROP POLICY IF EXISTS "Seasons schreibbar für Admin/Vorstand" ON public.seasons;
DROP POLICY IF EXISTS "season_cycles_delete" ON public.season_cycles;
DROP POLICY IF EXISTS "season_cycles_insert" ON public.season_cycles;
DROP POLICY IF EXISTS "season_cycles_update" ON public.season_cycles;
DROP POLICY IF EXISTS "season_phases_delete" ON public.season_phases;
DROP POLICY IF EXISTS "season_phases_insert" ON public.season_phases;
DROP POLICY IF EXISTS "season_phases_update" ON public.season_phases;
DROP POLICY IF EXISTS "substitute_requests_delete" ON public.substitute_requests;
DROP POLICY IF EXISTS "substitute_requests_insert" ON public.substitute_requests;
DROP POLICY IF EXISTS "substitute_requests_update" ON public.substitute_requests;
DROP POLICY IF EXISTS "Team_members löschbar für Admin/Vorstand/Trainer" ON public.team_members;
DROP POLICY IF EXISTS "Team_members schreibbar für Admin/Vorstand/Trainer" ON public.team_members;
DROP POLICY IF EXISTS "team_training_slots_delete" ON public.team_training_slots;
DROP POLICY IF EXISTS "team_training_slots_insert" ON public.team_training_slots;
DROP POLICY IF EXISTS "team_training_slots_update" ON public.team_training_slots;
DROP POLICY IF EXISTS "Teams aktualisierbar für Admin/Vorstand/Trainer" ON public.teams;
DROP POLICY IF EXISTS "Teams löschbar für Admin/Vorstand" ON public.teams;
DROP POLICY IF EXISTS "Teams schreibbar für Admin/Vorstand" ON public.teams;
DROP POLICY IF EXISTS "training_bookings_delete" ON public.training_bookings;
DROP POLICY IF EXISTS "training_bookings_insert" ON public.training_bookings;
DROP POLICY IF EXISTS "training_bookings_update" ON public.training_bookings;
DROP POLICY IF EXISTS "User_roles löschbar für Admin/Vorstand/Developer" ON public.user_roles;
DROP POLICY IF EXISTS "User_roles schreibbar für Admin/Vorstand/Developer" ON public.user_roles;
DROP POLICY IF EXISTS "Venues aktualisierbar für Admin/Vorstand" ON public.venues;
DROP POLICY IF EXISTS "Venues löschbar für Admin/Vorstand" ON public.venues;
DROP POLICY IF EXISTS "Venues schreibbar für Admin/Vorstand" ON public.venues;
DROP POLICY IF EXISTS "board_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "board_files_delete" ON storage.objects;

-- STEP 2: DROP functions
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);
DROP FUNCTION IF EXISTS public.is_admin_or_board(uuid);

-- STEP 3: Schema changes
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
UPDATE public.roles SET is_system = true WHERE name::text IN ('admin','vorstand','trainer','spieler','mitglied','developer','fördermitglied');
ALTER TABLE public.roles ALTER COLUMN name TYPE text USING name::text;
ALTER TABLE public.user_roles ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE public.role_module_permissions ALTER COLUMN role TYPE text USING role::text;

-- STEP 4: Recreate functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_board(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','vorstand'))
$$;

-- STEP 5: Recreate ALL policies
CREATE POLICY "Club_settings aktualisierbar für Admin" ON public.club_settings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Club_settings schreibbar für Admin" ON public.club_settings FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "comm_list_members_delete" ON public.communication_list_members FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "comm_list_members_insert" ON public.communication_list_members FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "comm_lists_delete" ON public.communication_lists FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "comm_lists_insert" ON public.communication_lists FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "comm_lists_update" ON public.communication_lists FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "consent_audit_log_insert" ON public.consent_audit_log FOR INSERT TO authenticated WITH CHECK (is_admin_or_board(auth.uid()) OR (member_id IN (SELECT id FROM members WHERE user_id = auth.uid())));
CREATE POLICY "consent_audit_log_select" ON public.consent_audit_log FOR SELECT TO authenticated USING (is_admin_or_board(auth.uid()) OR (member_id IN (SELECT id FROM members WHERE user_id = auth.uid())));
CREATE POLICY "deletion_requests_delete" ON public.deletion_requests FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "deletion_requests_insert" ON public.deletion_requests FOR INSERT TO authenticated WITH CHECK (is_admin_or_board(auth.uid()) OR (requested_by = auth.uid()));
CREATE POLICY "deletion_requests_select" ON public.deletion_requests FOR SELECT TO authenticated USING (is_admin_or_board(auth.uid()) OR (requested_by = auth.uid()));
CREATE POLICY "deletion_requests_update" ON public.deletion_requests FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "documents_delete" ON public.documents FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "documents_insert" ON public.documents FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "documents_update" ON public.documents FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "match_availability_delete" ON public.match_availability FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer'));
CREATE POLICY "match_availability_insert" ON public.match_availability FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer'));
CREATE POLICY "match_availability_update" ON public.match_availability FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer'));
CREATE POLICY "match_lineup_delete" ON public.match_lineup FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer'));
CREATE POLICY "match_lineup_insert" ON public.match_lineup FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer'));
CREATE POLICY "match_lineup_update" ON public.match_lineup FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer'));
CREATE POLICY "meeting_docs_delete" ON public.meeting_documents FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "meeting_docs_insert" ON public.meeting_documents FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "meeting_docs_select" ON public.meeting_documents FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "meetings_delete" ON public.meetings FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "meetings_insert" ON public.meetings FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "meetings_update" ON public.meetings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "Members aktualisierbar" ON public.members FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer') OR (user_id = auth.uid()));
CREATE POLICY "Members löschbar für Admin/Vorstand" ON public.members FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "Members schreibbar für Admin/Vorstand/Trainer" ON public.members FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer'));
CREATE POLICY "member_consents_insert" ON public.member_consents FOR INSERT TO authenticated WITH CHECK (is_admin_or_board(auth.uid()) OR (member_id IN (SELECT id FROM members WHERE user_id = auth.uid())));
CREATE POLICY "member_consents_select" ON public.member_consents FOR SELECT TO authenticated USING (is_admin_or_board(auth.uid()) OR (member_id IN (SELECT id FROM members WHERE user_id = auth.uid())));
CREATE POLICY "member_consents_update" ON public.member_consents FOR UPDATE TO authenticated USING (is_admin_or_board(auth.uid()) OR (member_id IN (SELECT id FROM members WHERE user_id = auth.uid())));
CREATE POLICY "news_delete" ON public.news FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "news_insert" ON public.news FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "news_update" ON public.news FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "role_module_permissions_delete" ON public.role_module_permissions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'developer') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "role_module_permissions_insert" ON public.role_module_permissions FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'developer') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "role_module_permissions_update" ON public.role_module_permissions FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'developer') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "roles_delete" ON public.roles FOR DELETE TO authenticated USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'developer')) AND is_system = false);
CREATE POLICY "roles_insert" ON public.roles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'developer') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "roles_update" ON public.roles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'developer') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "Schedule_matches aktualisierbar für Admin/Vorstand/Trainer" ON public.schedule_matches FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer'));
CREATE POLICY "Schedule_matches löschbar für Admin/Vorstand" ON public.schedule_matches FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "Schedule_matches schreibbar für Admin/Vorstand/Trainer" ON public.schedule_matches FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer'));
CREATE POLICY "Seasons aktualisierbar für Admin/Vorstand" ON public.seasons FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "Seasons löschbar für Admin/Vorstand" ON public.seasons FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "Seasons schreibbar für Admin/Vorstand" ON public.seasons FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "season_cycles_delete" ON public.season_cycles FOR DELETE TO authenticated USING (is_admin_or_board(auth.uid()));
CREATE POLICY "season_cycles_insert" ON public.season_cycles FOR INSERT TO authenticated WITH CHECK (is_admin_or_board(auth.uid()));
CREATE POLICY "season_cycles_update" ON public.season_cycles FOR UPDATE TO authenticated USING (is_admin_or_board(auth.uid()));
CREATE POLICY "season_phases_delete" ON public.season_phases FOR DELETE TO authenticated USING (is_admin_or_board(auth.uid()));
CREATE POLICY "season_phases_insert" ON public.season_phases FOR INSERT TO authenticated WITH CHECK (is_admin_or_board(auth.uid()));
CREATE POLICY "season_phases_update" ON public.season_phases FOR UPDATE TO authenticated USING (is_admin_or_board(auth.uid()));
CREATE POLICY "substitute_requests_delete" ON public.substitute_requests FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "substitute_requests_insert" ON public.substitute_requests FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer'));
CREATE POLICY "substitute_requests_update" ON public.substitute_requests FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer'));
CREATE POLICY "Team_members löschbar für Admin/Vorstand/Trainer" ON public.team_members FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer'));
CREATE POLICY "Team_members schreibbar für Admin/Vorstand/Trainer" ON public.team_members FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer'));
CREATE POLICY "team_training_slots_delete" ON public.team_training_slots FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer'));
CREATE POLICY "team_training_slots_insert" ON public.team_training_slots FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer'));
CREATE POLICY "team_training_slots_update" ON public.team_training_slots FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer'));
CREATE POLICY "Teams aktualisierbar für Admin/Vorstand/Trainer" ON public.teams FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer'));
CREATE POLICY "Teams löschbar für Admin/Vorstand" ON public.teams FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "Teams schreibbar für Admin/Vorstand" ON public.teams FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "training_bookings_delete" ON public.training_bookings FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR (created_by = auth.uid()));
CREATE POLICY "training_bookings_insert" ON public.training_bookings FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer') OR has_role(auth.uid(), 'spieler'));
CREATE POLICY "training_bookings_update" ON public.training_bookings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer') OR (created_by = auth.uid()));
CREATE POLICY "User_roles löschbar für Admin/Vorstand/Developer" ON public.user_roles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'developer') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "User_roles schreibbar für Admin/Vorstand/Developer" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'developer') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "Venues aktualisierbar für Admin/Vorstand" ON public.venues FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "Venues löschbar für Admin/Vorstand" ON public.venues FOR DELETE TO authenticated USING (is_admin_or_board(auth.uid()));
CREATE POLICY "Venues schreibbar für Admin/Vorstand" ON public.venues FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "board_files_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'board-files' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand')));
CREATE POLICY "board_files_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'board-files' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand')));

-- STEP 6: Protection trigger
CREATE OR REPLACE FUNCTION public.protect_system_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_system = true THEN
    RAISE EXCEPTION 'System-Rollen können nicht gelöscht werden';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_system = true THEN
    IF NEW.name != OLD.name THEN RAISE EXCEPTION 'System-Rollen können nicht umbenannt werden'; END IF;
    IF NEW.is_system != OLD.is_system THEN RAISE EXCEPTION 'System-Status kann nicht geändert werden'; END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_protect_system_roles
BEFORE UPDATE OR DELETE ON public.roles
FOR EACH ROW EXECUTE FUNCTION public.protect_system_roles();

-- STEP 7: Update handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.members (user_id, first_name, last_name, email, entry_date)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'first_name', ''), COALESCE(NEW.raw_user_meta_data->>'last_name', ''), NEW.email, CURRENT_DATE);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'mitglied');
  RETURN NEW;
END;
$$;
