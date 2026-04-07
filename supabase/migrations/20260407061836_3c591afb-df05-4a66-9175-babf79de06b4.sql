
-- ═══ match_availability: fehlende Spalten + Constraints ═══

ALTER TABLE public.match_availability
  ADD COLUMN IF NOT EXISTS team_id uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

-- Unique constraint: ein Spieler pro Spiel
ALTER TABLE public.match_availability
  ADD CONSTRAINT match_availability_match_member_unique UNIQUE (match_id, member_id);

-- ═══ match_lineup: fehlende Spalten + Constraints ═══

ALTER TABLE public.match_lineup
  ADD COLUMN IF NOT EXISTS team_id uuid,
  ADD COLUMN IF NOT EXISTS is_substitute boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Unique constraints
ALTER TABLE public.match_lineup
  ADD CONSTRAINT match_lineup_match_member_unique UNIQUE (match_id, member_id);

ALTER TABLE public.match_lineup
  ADD CONSTRAINT match_lineup_match_position_unique UNIQUE (match_id, position);

-- updated_at trigger for match_lineup
CREATE TRIGGER update_match_lineup_updated_at
  BEFORE UPDATE ON public.match_lineup
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
