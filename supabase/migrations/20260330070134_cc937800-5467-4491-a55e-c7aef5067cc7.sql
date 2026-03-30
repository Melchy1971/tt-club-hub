
-- Create substitute request status enum
DO $$ BEGIN
  CREATE TYPE public.substitute_status AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create substitute_requests table
CREATE TABLE IF NOT EXISTS public.substitute_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.schedule_matches(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  requesting_member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  substitute_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  status public.substitute_status NOT NULL DEFAULT 'pending',
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.substitute_requests ENABLE ROW LEVEL SECURITY;

-- RLS: readable by all authenticated
CREATE POLICY "substitute_requests_select" ON public.substitute_requests
  FOR SELECT TO authenticated USING (true);

-- RLS: insert for trainer/vorstand/admin
CREATE POLICY "substitute_requests_insert" ON public.substitute_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vorstand'::app_role)
    OR has_role(auth.uid(), 'trainer'::app_role)
  );

-- RLS: update for trainer/vorstand/admin
CREATE POLICY "substitute_requests_update" ON public.substitute_requests
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vorstand'::app_role)
    OR has_role(auth.uid(), 'trainer'::app_role)
  );

-- RLS: delete for admin/vorstand
CREATE POLICY "substitute_requests_delete" ON public.substitute_requests
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vorstand'::app_role)
  );

-- Trigger for updated_at
CREATE TRIGGER update_substitute_requests_updated_at
  BEFORE UPDATE ON public.substitute_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
