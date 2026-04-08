-- Drop existing restrictive policies
DROP POLICY IF EXISTS "User_roles schreibbar für Admin" ON public.user_roles;
DROP POLICY IF EXISTS "User_roles löschbar für Admin" ON public.user_roles;

-- Recreate with admin, developer, vorstand access
CREATE POLICY "User_roles schreibbar für Admin/Vorstand/Developer" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'developer'::app_role)
    OR has_role(auth.uid(), 'vorstand'::app_role)
  );

CREATE POLICY "User_roles löschbar für Admin/Vorstand/Developer" ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'developer'::app_role)
    OR has_role(auth.uid(), 'vorstand'::app_role)
  );