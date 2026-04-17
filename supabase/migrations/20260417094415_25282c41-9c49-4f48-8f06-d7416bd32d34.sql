-- Ergänze fehlende Unique-Constraint für user_roles (für ON CONFLICT)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_role_key'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;

-- Trigger-Funktion: bei Mitglied mit user_id automatisch Rolle 'mitglied' setzen
CREATE OR REPLACE FUNCTION public.ensure_member_default_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'mitglied')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger auf members: INSERT und UPDATE von user_id
DROP TRIGGER IF EXISTS members_ensure_default_role ON public.members;
CREATE TRIGGER members_ensure_default_role
AFTER INSERT OR UPDATE OF user_id ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.ensure_member_default_role();

-- Backfill: alle bestehenden verknüpften Mitglieder bekommen 'mitglied'
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT m.user_id, 'mitglied'
FROM public.members m
WHERE m.user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;