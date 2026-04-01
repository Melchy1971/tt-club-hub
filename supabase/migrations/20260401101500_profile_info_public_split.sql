-- Standardisierte Datenversorgung Profil/Info
-- 1) Öffentliche Club-Info als abgesichertes Lesemodell
CREATE OR REPLACE VIEW public.club_public_info
WITH (security_invoker = true)
AS
SELECT
  cs.club_name,
  cs.club_number,
  cs.association,
  cs.website,
  cs.contact_email,
  cs.contact_phone,
  cs.street,
  cs.zip_code,
  cs.city
FROM public.club_settings cs;

GRANT SELECT ON public.club_public_info TO anon, authenticated;

-- 2) Interne Club-Settings enger absichern
DROP POLICY IF EXISTS "Club_settings sind für alle authentifizierten Nutzer lesbar" ON public.club_settings;
CREATE POLICY "Club_settings lesbar für Admin/Vorstand"
  ON public.club_settings FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'vorstand')
    OR has_role(auth.uid(), 'developer')
  );

-- 3) Query-freundliche Member-Ansicht (ohne sensible Zusatzdaten)
CREATE OR REPLACE VIEW public.member_profile_view
WITH (security_invoker = true)
AS
SELECT
  m.id,
  m.user_id,
  m.first_name,
  m.last_name,
  m.email,
  m.phone,
  m.street,
  m.zip_code,
  m.city,
  m.is_active,
  m.ttr_rating,
  m.qttr_rating
FROM public.members m;

GRANT SELECT ON public.member_profile_view TO authenticated;
