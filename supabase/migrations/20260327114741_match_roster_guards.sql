-- Guards & triggers for match_availabilities and match_lineups

-- Helper: check match status
CREATE OR REPLACE FUNCTION public.fn_match_is_open(p_match_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT status IN ('geplant','laufend','verschoben')
  FROM public.schedule_matches
  WHERE id = p_match_id;
$$;

-- Trigger: block write if match is closed (beendet/abgesagt)
CREATE OR REPLACE FUNCTION public.trg_block_closed_match()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.fn_match_is_open(COALESCE(NEW.match_id, OLD.match_id)) THEN
    RAISE EXCEPTION 'Match % ist geschlossen; Änderungen nicht erlaubt', COALESCE(NEW.match_id, OLD.match_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Helper: member must belong to the match team
CREATE OR REPLACE FUNCTION public.fn_member_in_match_team(p_match_id uuid, p_member_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.schedule_matches sm
    JOIN public.team_members tm ON tm.team_id = sm.team_id
    WHERE sm.id = p_match_id AND tm.member_id = p_member_id
  );
$$;

CREATE OR REPLACE FUNCTION public.trg_check_member_in_team()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.fn_member_in_match_team(NEW.match_id, NEW.member_id) THEN
    RAISE EXCEPTION 'Member % gehört nicht zum Team dieses Spiels %', NEW.member_id, NEW.match_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Helper: lineup must not include unavailable players
CREATE OR REPLACE FUNCTION public.trg_block_unavailable_in_lineup()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  avail_status TEXT;
BEGIN
  SELECT status INTO avail_status
  FROM public.match_availabilities
  WHERE match_id = NEW.match_id AND member_id = NEW.member_id;

  IF avail_status = 'unavailable' THEN
    RAISE EXCEPTION 'Member % ist als unavailable markiert und kann nicht aufgestellt werden', NEW.member_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach triggers
DROP TRIGGER IF EXISTS block_closed_match_avail ON public.match_availabilities;
CREATE TRIGGER block_closed_match_avail
  BEFORE INSERT OR UPDATE OR DELETE ON public.match_availabilities
  FOR EACH ROW EXECUTE FUNCTION public.trg_block_closed_match();

DROP TRIGGER IF EXISTS block_closed_match_lineup ON public.match_lineups;
CREATE TRIGGER block_closed_match_lineup
  BEFORE INSERT OR UPDATE OR DELETE ON public.match_lineups
  FOR EACH ROW EXECUTE FUNCTION public.trg_block_closed_match();

DROP TRIGGER IF EXISTS check_member_team_avail ON public.match_availabilities;
CREATE TRIGGER check_member_team_avail
  BEFORE INSERT OR UPDATE ON public.match_availabilities
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_member_in_team();

DROP TRIGGER IF EXISTS check_member_team_lineup ON public.match_lineups;
CREATE TRIGGER check_member_team_lineup
  BEFORE INSERT OR UPDATE ON public.match_lineups
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_member_in_team();

DROP TRIGGER IF EXISTS block_unavailable_lineup ON public.match_lineups;
CREATE TRIGGER block_unavailable_lineup
  BEFORE INSERT OR UPDATE ON public.match_lineups
  FOR EACH ROW EXECUTE FUNCTION public.trg_block_unavailable_in_lineup();
