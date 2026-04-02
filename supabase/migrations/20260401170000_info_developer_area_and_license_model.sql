-- Info-Seite & Entwicklerbereich: Tool-Metadaten + Lizenzmodell

CREATE TABLE IF NOT EXISTS public.tool_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  build_date date NOT NULL,
  support_email text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tool_metadata_support_email_chk CHECK (position('@' in support_email) > 1)
);

CREATE TABLE IF NOT EXISTS public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_key text NOT NULL UNIQUE,
  status text NOT NULL,
  activated_at timestamptz,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT licenses_status_chk CHECK (status IN ('active', 'inactive', 'expired', 'revoked')),
  CONSTRAINT licenses_valid_window_chk CHECK (valid_until IS NULL OR activated_at IS NULL OR valid_until >= activated_at)
);

ALTER TABLE public.tool_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tool_metadata read developer" ON public.tool_metadata;
CREATE POLICY "tool_metadata read developer"
  ON public.tool_metadata
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'developer'));

DROP POLICY IF EXISTS "tool_metadata write developer" ON public.tool_metadata;
CREATE POLICY "tool_metadata write developer"
  ON public.tool_metadata
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'developer'))
  WITH CHECK (has_role(auth.uid(), 'developer'));

DROP POLICY IF EXISTS "licenses read developer" ON public.licenses;
CREATE POLICY "licenses read developer"
  ON public.licenses
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'developer'));

DROP POLICY IF EXISTS "licenses write developer" ON public.licenses;
CREATE POLICY "licenses write developer"
  ON public.licenses
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'developer'))
  WITH CHECK (has_role(auth.uid(), 'developer'));

GRANT SELECT ON public.tool_metadata TO authenticated;
GRANT SELECT ON public.licenses TO authenticated;

INSERT INTO public.tool_metadata (version, build_date, support_email, is_active)
SELECT '1.0.0', CURRENT_DATE, 'support@ttv-pro.de', true
WHERE NOT EXISTS (SELECT 1 FROM public.tool_metadata);

INSERT INTO public.licenses (serial_key, status, activated_at, valid_until)
SELECT 'DEV-UNLICENSED', 'inactive', null, null
WHERE NOT EXISTS (SELECT 1 FROM public.licenses);

DO $$
DECLARE
  missing_count int;
BEGIN
  SELECT count(*) INTO missing_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('tool_metadata', 'licenses');

  IF missing_count <> 2 THEN
    RAISE EXCEPTION 'Security check failed: expected tables tool_metadata + licenses';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'tool_metadata' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Security check failed: RLS missing on tool_metadata';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'licenses' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Security check failed: RLS missing on licenses';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tool_metadata' AND policyname = 'tool_metadata read developer'
  ) THEN
    RAISE EXCEPTION 'Security check failed: policy tool_metadata read developer missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'licenses' AND policyname = 'licenses read developer'
  ) THEN
    RAISE EXCEPTION 'Security check failed: policy licenses read developer missing';
  END IF;
END $$;
