-- Privacy / Audit hardening:
-- - consent model constraints + deterministic consent types
-- - consent audit metadata (IP + user-agent + timestamp)
-- - deletion workflow state machine in DB
-- - self-service vs admin privacy views
-- - RPC APIs to make write-path atomic and auditable

-- 1) Stronger constraints for consents
ALTER TABLE public.member_consents
  ADD CONSTRAINT member_consents_member_consent_type_unique UNIQUE (member_id, consent_type);

ALTER TABLE public.member_consents
  ADD CONSTRAINT member_consents_consent_type_chk
  CHECK (consent_type IN ('profile_visible', 'email_hidden', 'phone_hidden'));

-- Normalize existing rows where granted_at / revoked_at are still null.
UPDATE public.member_consents
SET
  granted_at = CASE WHEN granted = true AND granted_at IS NULL THEN created_at ELSE granted_at END,
  revoked_at = CASE WHEN granted = false AND revoked_at IS NULL THEN created_at ELSE revoked_at END
WHERE
  (granted = true AND granted_at IS NULL)
  OR (granted = false AND revoked_at IS NULL);

ALTER TABLE public.member_consents
  ADD CONSTRAINT member_consents_timestamps_chk
  CHECK (
    (granted = true AND granted_at IS NOT NULL AND revoked_at IS NULL)
    OR (granted = false AND revoked_at IS NOT NULL AND granted_at IS NULL)
  );

-- 2) Audit metadata for consent changes
ALTER TABLE public.consent_audit_log
  ADD COLUMN actor_ip INET,
  ADD COLUMN actor_user_agent TEXT,
  ADD COLUMN action_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.consent_audit_log
  ADD CONSTRAINT consent_audit_log_action_chk
  CHECK (
    action IN (
      'granted:self',
      'revoked:self',
      'granted:admin',
      'revoked:admin',
      'granted:import',
      'revoked:import',
      'granted:system',
      'revoked:system'
    )
  );

CREATE INDEX consent_audit_log_member_action_at_idx
  ON public.consent_audit_log (member_id, action_at DESC);

-- 3) Deletion workflow hardening
ALTER TABLE public.deletion_requests
  ADD COLUMN requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN execution_started_at TIMESTAMPTZ,
  ADD COLUMN completed_at TIMESTAMPTZ,
  ADD COLUMN decision_note TEXT,
  ADD COLUMN legal_hold BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN actor_ip INET,
  ADD COLUMN actor_user_agent TEXT;

ALTER TABLE public.deletion_requests
  ADD CONSTRAINT deletion_requests_status_chk
  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'executing', 'completed'));

CREATE OR REPLACE FUNCTION public.enforce_deletion_request_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status NOT IN ('approved', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'invalid transition from pending to %', NEW.status;
  ELSIF OLD.status = 'approved' AND NEW.status NOT IN ('executing', 'cancelled') THEN
    RAISE EXCEPTION 'invalid transition from approved to %', NEW.status;
  ELSIF OLD.status = 'executing' AND NEW.status NOT IN ('completed') THEN
    RAISE EXCEPTION 'invalid transition from executing to %', NEW.status;
  ELSIF OLD.status IN ('rejected', 'cancelled', 'completed') THEN
    RAISE EXCEPTION 'terminal status % cannot transition to %', OLD.status, NEW.status;
  END IF;

  IF NEW.status = 'approved' THEN
    NEW.reviewed_at := now();
    NEW.execution_started_at := NULL;
    NEW.completed_at := NULL;
  ELSIF NEW.status = 'executing' THEN
    NEW.execution_started_at := now();
  ELSIF NEW.status = 'completed' THEN
    NEW.completed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deletion_requests_transition_guard ON public.deletion_requests;
CREATE TRIGGER deletion_requests_transition_guard
  BEFORE UPDATE OF status ON public.deletion_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_deletion_request_transition();

-- 4) Self-service vs admin privacy visibility
CREATE OR REPLACE VIEW public.member_privacy_self_view AS
SELECT
  m.id AS member_id,
  m.user_id,
  m.first_name,
  m.last_name,
  m.email,
  m.phone,
  m.mobile,
  m.date_of_birth,
  m.street,
  m.zip_code,
  m.city
FROM public.members m
WHERE m.user_id = auth.uid();

CREATE OR REPLACE VIEW public.member_privacy_admin_view AS
SELECT
  m.id AS member_id,
  m.first_name,
  m.last_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.member_consents c
      WHERE c.member_id = m.id
        AND c.consent_type = 'email_hidden'
        AND c.granted = true
    ) THEN NULL
    ELSE m.email
  END AS email,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.member_consents c
      WHERE c.member_id = m.id
        AND c.consent_type = 'phone_hidden'
        AND c.granted = true
    ) THEN NULL
    ELSE COALESCE(m.mobile, m.phone)
  END AS phone,
  m.city,
  m.is_active
FROM public.members m;

GRANT SELECT ON public.member_privacy_self_view TO authenticated;
GRANT SELECT ON public.member_privacy_admin_view TO authenticated;

-- 5) Atomic RPC: set consent + audit line
CREATE OR REPLACE FUNCTION public.rpc_set_member_consent(
  p_member_id UUID,
  p_consent_type TEXT,
  p_granted BOOLEAN,
  p_source TEXT DEFAULT 'self',
  p_actor_ip INET DEFAULT NULL,
  p_actor_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_action TEXT;
BEGIN
  IF p_source NOT IN ('self', 'admin', 'import', 'system') THEN
    RAISE EXCEPTION 'invalid source: %', p_source;
  END IF;

  v_action := CASE WHEN p_granted THEN 'granted' ELSE 'revoked' END || ':' || p_source;

  INSERT INTO public.member_consents (member_id, consent_type, granted, granted_at, revoked_at)
  VALUES (
    p_member_id,
    p_consent_type,
    p_granted,
    CASE WHEN p_granted THEN v_now ELSE NULL END,
    CASE WHEN p_granted THEN NULL ELSE v_now END
  )
  ON CONFLICT (member_id, consent_type)
  DO UPDATE SET
    granted = EXCLUDED.granted,
    granted_at = EXCLUDED.granted_at,
    revoked_at = EXCLUDED.revoked_at,
    updated_at = v_now;

  INSERT INTO public.consent_audit_log (
    member_id, consent_type, action, performed_by, actor_ip, actor_user_agent, action_at
  )
  VALUES (
    p_member_id, p_consent_type, v_action, auth.uid(), p_actor_ip, p_actor_user_agent, v_now
  );
END;
$$;

-- 6) RPC: creation + transition for deletion requests
CREATE OR REPLACE FUNCTION public.rpc_create_deletion_request(
  p_member_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_actor_ip INET DEFAULT NULL,
  p_actor_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.deletion_requests (
    member_id, reason, status, requested_by, requested_at, actor_ip, actor_user_agent
  )
  VALUES (
    p_member_id, p_reason, 'pending', auth.uid(), now(), p_actor_ip, p_actor_user_agent
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_transition_deletion_request(
  p_request_id UUID,
  p_next_status TEXT,
  p_decision_note TEXT DEFAULT NULL,
  p_actor_ip INET DEFAULT NULL,
  p_actor_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.deletion_requests
  SET
    status = p_next_status,
    reviewed_by = auth.uid(),
    decision_note = p_decision_note,
    actor_ip = p_actor_ip,
    actor_user_agent = p_actor_user_agent,
    updated_at = now()
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deletion_request not found: %', p_request_id;
  END IF;
END;
$$;
