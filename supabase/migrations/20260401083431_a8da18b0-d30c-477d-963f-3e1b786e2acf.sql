
-- 1. Helper: is_admin_or_board
CREATE OR REPLACE FUNCTION public.is_admin_or_board(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'vorstand')
  )
$$;

-- 2. member_consents: Mitglieder dürfen eigene Consents lesen und verwalten
DROP POLICY IF EXISTS "member_consents_select" ON public.member_consents;
CREATE POLICY "member_consents_select" ON public.member_consents FOR SELECT TO authenticated
  USING (
    is_admin_or_board(auth.uid())
    OR member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "member_consents_insert" ON public.member_consents;
CREATE POLICY "member_consents_insert" ON public.member_consents FOR INSERT TO authenticated
  WITH CHECK (
    is_admin_or_board(auth.uid())
    OR member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "member_consents_update" ON public.member_consents;
CREATE POLICY "member_consents_update" ON public.member_consents FOR UPDATE TO authenticated
  USING (
    is_admin_or_board(auth.uid())
    OR member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  );

-- 3. consent_audit_log: nur eigene oder Admin/Vorstand
DROP POLICY IF EXISTS "consent_audit_log_select" ON public.consent_audit_log;
CREATE POLICY "consent_audit_log_select" ON public.consent_audit_log FOR SELECT TO authenticated
  USING (
    is_admin_or_board(auth.uid())
    OR member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "consent_audit_log_insert" ON public.consent_audit_log;
CREATE POLICY "consent_audit_log_insert" ON public.consent_audit_log FOR INSERT TO authenticated
  WITH CHECK (
    is_admin_or_board(auth.uid())
    OR member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  );

-- 4. deletion_requests: Mitglieder dürfen eigene Löschanfragen erstellen und sehen
DROP POLICY IF EXISTS "deletion_requests_select" ON public.deletion_requests;
CREATE POLICY "deletion_requests_select" ON public.deletion_requests FOR SELECT TO authenticated
  USING (
    is_admin_or_board(auth.uid())
    OR requested_by = auth.uid()
  );

DROP POLICY IF EXISTS "deletion_requests_insert" ON public.deletion_requests;
CREATE POLICY "deletion_requests_insert" ON public.deletion_requests FOR INSERT TO authenticated
  WITH CHECK (
    is_admin_or_board(auth.uid())
    OR requested_by = auth.uid()
  );

-- deletion_requests update/delete bleibt nur Admin/Vorstand (bereits korrekt)

-- 5. members: eigenes Profil updaten erlauben
DROP POLICY IF EXISTS "Members aktualisierbar für Admin/Vorstand/Trainer" ON public.members;
CREATE POLICY "Members aktualisierbar" ON public.members FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer')
    OR user_id = auth.uid()
  );

-- 6. venues: DELETE für Admin/Vorstand hinzufügen (fehlte)
CREATE POLICY "Venues löschbar für Admin/Vorstand" ON public.venues FOR DELETE TO authenticated
  USING (is_admin_or_board(auth.uid()));
