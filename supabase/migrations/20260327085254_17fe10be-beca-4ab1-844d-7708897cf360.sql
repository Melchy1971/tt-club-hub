
-- Add age_group column to seasons
ALTER TABLE public.seasons ADD COLUMN age_group age_group NOT NULL DEFAULT 'herren';

-- Create a unique partial index: only one is_current=true per age_group
CREATE UNIQUE INDEX seasons_one_current_per_age_group ON public.seasons (age_group) WHERE is_current = true;

-- Create a function to deactivate other seasons of the same age_group when one is set to current
CREATE OR REPLACE FUNCTION public.deactivate_other_seasons()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE public.seasons
    SET is_current = false, updated_at = now()
    WHERE age_group = NEW.age_group
      AND id != NEW.id
      AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deactivate_other_seasons
  BEFORE INSERT OR UPDATE OF is_current ON public.seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.deactivate_other_seasons();
