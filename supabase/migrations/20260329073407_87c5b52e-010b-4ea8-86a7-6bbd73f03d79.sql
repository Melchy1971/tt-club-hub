ALTER TABLE public.schedule_matches ADD COLUMN IF NOT EXISTS pin text DEFAULT NULL;
ALTER TABLE public.schedule_matches ADD COLUMN IF NOT EXISTS code text DEFAULT NULL;