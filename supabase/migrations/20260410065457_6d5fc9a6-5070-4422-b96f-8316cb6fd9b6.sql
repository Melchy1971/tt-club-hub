INSERT INTO storage.buckets (id, name, public) VALUES ('club-logos', 'club-logos', true);

CREATE POLICY "Authenticated users can upload club logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'club-logos');

CREATE POLICY "Authenticated users can update club logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'club-logos');

CREATE POLICY "Anyone can read club logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'club-logos');

CREATE POLICY "Authenticated users can delete club logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'club-logos');