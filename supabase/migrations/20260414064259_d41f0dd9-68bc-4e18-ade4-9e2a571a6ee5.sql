
-- roles: INSERT for admin/vorstand/developer
CREATE POLICY "roles_insert"
ON public.roles FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'developer'::app_role)
  OR has_role(auth.uid(), 'vorstand'::app_role)
);

-- roles: UPDATE for admin/vorstand/developer
CREATE POLICY "roles_update"
ON public.roles FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'developer'::app_role)
  OR has_role(auth.uid(), 'vorstand'::app_role)
);

-- roles: DELETE for admin/developer only
CREATE POLICY "roles_delete"
ON public.roles FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'developer'::app_role)
);

-- role_module_permissions: extend write access to vorstand/developer
DROP POLICY IF EXISTS "role_module_permissions_insert" ON public.role_module_permissions;
CREATE POLICY "role_module_permissions_insert"
ON public.role_module_permissions FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'developer'::app_role)
  OR has_role(auth.uid(), 'vorstand'::app_role)
);

DROP POLICY IF EXISTS "role_module_permissions_update" ON public.role_module_permissions;
CREATE POLICY "role_module_permissions_update"
ON public.role_module_permissions FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'developer'::app_role)
  OR has_role(auth.uid(), 'vorstand'::app_role)
);

DROP POLICY IF EXISTS "role_module_permissions_delete" ON public.role_module_permissions;
CREATE POLICY "role_module_permissions_delete"
ON public.role_module_permissions FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'developer'::app_role)
  OR has_role(auth.uid(), 'vorstand'::app_role)
);
