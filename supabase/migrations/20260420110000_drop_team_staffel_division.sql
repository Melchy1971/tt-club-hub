-- Remove deprecated team staffel field.
-- Staffel info is represented implicitly in teams.league.
UPDATE public.teams
SET league = division
WHERE division IS NOT NULL
  AND NULLIF(BTRIM(league), '') IS NULL;

ALTER TABLE public.teams
  DROP COLUMN IF EXISTS division;
