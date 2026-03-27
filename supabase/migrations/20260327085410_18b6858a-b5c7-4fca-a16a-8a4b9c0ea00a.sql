
-- Allow admin/vorstand to delete seasons
CREATE POLICY "Seasons löschbar für Admin/Vorstand"
ON public.seasons
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vorstand'::app_role));

-- Allow admin/vorstand to update seasons (policy already exists but let's ensure age_group changes work)
