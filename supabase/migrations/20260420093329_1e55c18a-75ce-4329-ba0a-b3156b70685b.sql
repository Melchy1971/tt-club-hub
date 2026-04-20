-- =========================================================
-- 1. Neue Tabelle member_roles
-- =========================================================
CREATE TABLE IF NOT EXISTS public.member_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  role text NOT NULL,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_roles_member_role_unique UNIQUE (member_id, role)
);

CREATE INDEX IF NOT EXISTS idx_member_roles_member_id ON public.member_roles(member_id);
CREATE INDEX IF NOT EXISTS idx_member_roles_role ON public.member_roles(role);

ALTER TABLE public.member_roles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 2. Daten aus user_roles übernehmen (über members.user_id)
-- =========================================================
INSERT INTO public.member_roles (member_id, role, assigned_by, created_at)
SELECT DISTINCT ON (m.id, ur.role)
  m.id, ur.role, ur.assigned_by, ur.created_at
FROM public.user_roles ur
JOIN public.members m ON m.user_id = ur.user_id
ON CONFLICT (member_id, role) DO NOTHING;

-- Backfill: jedes Mitglied bekommt 'mitglied'
INSERT INTO public.member_roles (member_id, role)
SELECT id, 'mitglied' FROM public.members
ON CONFLICT (member_id, role) DO NOTHING;

-- =========================================================
-- 3. Funktionen umbauen (Signatur bleibt gleich!)
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.member_roles mr
    JOIN public.members m ON m.id = mr.member_id
    WHERE m.user_id = _user_id AND mr.role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_board(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.member_roles mr
    JOIN public.members m ON m.id = mr.member_id
    WHERE m.user_id = _user_id AND mr.role IN ('admin','vorstand')
  )
$$;

-- =========================================================
-- 4. Trigger: jedes Mitglied bekommt automatisch 'mitglied'
-- =========================================================
CREATE OR REPLACE FUNCTION public.ensure_member_default_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.member_roles (member_id, role)
  VALUES (NEW.id, 'mitglied')
  ON CONFLICT (member_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS members_ensure_default_role ON public.members;
CREATE TRIGGER members_ensure_default_role
AFTER INSERT ON public.members
FOR EACH ROW EXECUTE FUNCTION public.ensure_member_default_role();

-- handle_new_user: legt Mitglied an, Rolle wird über members-Trigger gesetzt
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.members (user_id, first_name, last_name, email, entry_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    CURRENT_DATE
  );
  RETURN NEW;
END;
$$;

-- =========================================================
-- 5. RLS-Policies für member_roles
-- =========================================================
DROP POLICY IF EXISTS "member_roles_select" ON public.member_roles;
CREATE POLICY "member_roles_select"
ON public.member_roles FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "member_roles_insert" ON public.member_roles;
CREATE POLICY "member_roles_insert"
ON public.member_roles FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'developer')
  OR has_role(auth.uid(), 'vorstand')
);

DROP POLICY IF EXISTS "member_roles_delete" ON public.member_roles;
CREATE POLICY "member_roles_delete"
ON public.member_roles FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'developer')
  OR has_role(auth.uid(), 'vorstand')
);

-- =========================================================
-- 6. Alte Tabelle user_roles entfernen
-- =========================================================
DROP TABLE IF EXISTS public.user_roles CASCADE;
