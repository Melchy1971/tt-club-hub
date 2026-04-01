
-- 1. Consent-Einträge pro Mitglied
CREATE TABLE public.member_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT false,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Consent-Audit-Log
CREATE TABLE public.consent_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  action TEXT NOT NULL,
  performed_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Löschanfragen
CREATE TABLE public.deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by UUID NOT NULL,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS aktivieren
ALTER TABLE public.member_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

-- member_consents policies
CREATE POLICY "member_consents_select" ON public.member_consents FOR SELECT TO authenticated USING (true);
CREATE POLICY "member_consents_insert" ON public.member_consents FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand')
);
CREATE POLICY "member_consents_update" ON public.member_consents FOR UPDATE TO authenticated USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand')
);

-- consent_audit_log policies
CREATE POLICY "consent_audit_log_select" ON public.consent_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "consent_audit_log_insert" ON public.consent_audit_log FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand')
);

-- deletion_requests policies
CREATE POLICY "deletion_requests_select" ON public.deletion_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "deletion_requests_insert" ON public.deletion_requests FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand')
);
CREATE POLICY "deletion_requests_update" ON public.deletion_requests FOR UPDATE TO authenticated USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand')
);
CREATE POLICY "deletion_requests_delete" ON public.deletion_requests FOR DELETE TO authenticated USING (
  has_role(auth.uid(), 'admin')
);

-- updated_at trigger
CREATE TRIGGER member_consents_updated_at BEFORE UPDATE ON public.member_consents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER deletion_requests_updated_at BEFORE UPDATE ON public.deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
