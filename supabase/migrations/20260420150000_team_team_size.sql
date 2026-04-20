ALTER TABLE public.teams
  ADD COLUMN team_size INTEGER CHECK (team_size IN (4, 6));
