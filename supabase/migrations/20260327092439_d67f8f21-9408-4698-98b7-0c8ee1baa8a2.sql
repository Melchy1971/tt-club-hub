
-- Permission level enum
CREATE TYPE public.permission_level AS ENUM ('none', 'read', 'write');

-- Role module permissions table
CREATE TABLE public.role_module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  module text NOT NULL,
  level public.permission_level NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, module)
);

-- Enable RLS
ALTER TABLE public.role_module_permissions ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "role_module_permissions_select" ON public.role_module_permissions
  FOR SELECT TO authenticated USING (true);

-- Only admins can modify
CREATE POLICY "role_module_permissions_insert" ON public.role_module_permissions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "role_module_permissions_update" ON public.role_module_permissions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "role_module_permissions_delete" ON public.role_module_permissions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_role_module_permissions_updated_at
  BEFORE UPDATE ON public.role_module_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default permissions
INSERT INTO public.role_module_permissions (role, module, level) VALUES
  -- developer: full access
  ('developer', 'dashboard', 'write'), ('developer', 'teams', 'write'), ('developer', 'schedule', 'write'),
  ('developer', 'members', 'write'), ('developer', 'communication', 'write'), ('developer', 'board', 'write'),
  ('developer', 'settings', 'write'), ('developer', 'import', 'write'),
  -- admin: full access
  ('admin', 'dashboard', 'write'), ('admin', 'teams', 'write'), ('admin', 'schedule', 'write'),
  ('admin', 'members', 'write'), ('admin', 'communication', 'write'), ('admin', 'board', 'write'),
  ('admin', 'settings', 'write'), ('admin', 'import', 'write'),
  -- vorstand
  ('vorstand', 'dashboard', 'read'), ('vorstand', 'teams', 'write'), ('vorstand', 'schedule', 'read'),
  ('vorstand', 'members', 'write'), ('vorstand', 'communication', 'write'), ('vorstand', 'board', 'write'),
  ('vorstand', 'settings', 'write'), ('vorstand', 'import', 'read'),
  -- trainer
  ('trainer', 'dashboard', 'read'), ('trainer', 'teams', 'write'), ('trainer', 'schedule', 'write'),
  ('trainer', 'members', 'read'), ('trainer', 'communication', 'write'), ('trainer', 'board', 'none'),
  ('trainer', 'settings', 'none'), ('trainer', 'import', 'none'),
  -- spieler
  ('spieler', 'dashboard', 'read'), ('spieler', 'teams', 'read'), ('spieler', 'schedule', 'read'),
  ('spieler', 'members', 'read'), ('spieler', 'communication', 'read'), ('spieler', 'board', 'none'),
  ('spieler', 'settings', 'none'), ('spieler', 'import', 'none'),
  -- mitglied
  ('mitglied', 'dashboard', 'read'), ('mitglied', 'teams', 'read'), ('mitglied', 'schedule', 'read'),
  ('mitglied', 'members', 'read'), ('mitglied', 'communication', 'none'), ('mitglied', 'board', 'none'),
  ('mitglied', 'settings', 'none'), ('mitglied', 'import', 'none');
