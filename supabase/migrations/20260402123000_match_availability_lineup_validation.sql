-- Verfügbarkeits- und Aufstellungslogik konsolidieren
-- Ziele:
-- 1) match_player_availability als operative Tabelle absichern
-- 2) Statuswerte auf available/unavailable/unknown begrenzen
-- 3) Aufstellung getrennt halten (match_lineups)
-- 4) nur Teamspieler der Match-Mannschaft + season_phase zulassen
-- 5) Konflikte hart validieren (Duplikat/falsches Team/inaktiv)
-- 6) Schreibrechte nur trainer/vorstand/admin

-- ---------------------------------------------------------------------------
-- 1) Availability-Enum auf 3 Statuswerte normieren
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'availability_status'
      AND t.typnamespace = 'public'::regnamespace
  ) THEN
    -- Mapping vor Typwechsel: uncertain -> unknown
    UPDATE public.match_player_availability
    SET status = 'unknown'::public.availability_status
    WHERE status = 'uncertain'::public.availability_status;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_type t
      WHERE t.typname = 'availability_status_v2'
        AND t.typnamespace = 'public'::regnamespace
    ) THEN
      CREATE TYPE public.availability_status_v2 AS ENUM ('unknown', 'available', 'unavailable');
    END IF;

    ALTER TABLE public.match_player_availability
      ALTER COLUMN status TYPE public.availability_status_v2
      USING status::text::public.availability_status_v2;

    DROP TYPE public.availability_status;
    ALTER TYPE public.availability_status_v2 RENAME TO availability_status;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Gemeinsame Validierung für Verfügbarkeit/Aufstellung
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_validate_match_member_assignment(
  p_match_id UUID,
  p_team_id UUID,
  p_member_id UUID,
  p_context TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_match_team_id UUID;
  v_match_phase_id UUID;
  v_team_phase_id UUID;
  v_team_active BOOLEAN;
BEGIN
  SELECT m.team_id, m.season_phase_id
    INTO v_match_team_id, v_match_phase_id
  FROM public.schedule_matches m
  WHERE m.id = p_match_id;

  IF v_match_team_id IS NULL THEN
    RAISE EXCEPTION '%: match_id % existiert nicht', p_context, p_match_id;
  END IF;

  IF v_match_team_id IS DISTINCT FROM p_team_id THEN
    RAISE EXCEPTION '%: falsche Mannschaft (match.team_id=%, payload.team_id=%)', p_context, v_match_team_id, p_team_id;
  END IF;

  SELECT t.season_phase_id, t.is_active
    INTO v_team_phase_id, v_team_active
  FROM public.teams t
  WHERE t.id = p_team_id;

  IF v_team_phase_id IS NULL THEN
    RAISE EXCEPTION '%: team_id % existiert nicht', p_context, p_team_id;
  END IF;

  IF v_team_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION '%: inaktive Teamzuordnung (Team % ist inaktiv)', p_context, p_team_id;
  END IF;

  IF v_team_phase_id IS DISTINCT FROM v_match_phase_id THEN
    RAISE EXCEPTION '%: season_phase Konflikt (team.phase=%, match.phase=%)', p_context, v_team_phase_id, v_match_phase_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.team_id = p_team_id
      AND tm.member_id = p_member_id
  ) THEN
    RAISE EXCEPTION '%: Spieler % ist nicht der Mannschaft % zugeordnet', p_context, p_member_id, p_team_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.members mem
    WHERE mem.id = p_member_id
      AND mem.is_active = false
  ) THEN
    RAISE EXCEPTION '%: inaktive Teamzuordnung (Mitglied % ist inaktiv)', p_context, p_member_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_validate_match_player_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.fn_validate_match_member_assignment(
    NEW.match_id,
    NEW.team_id,
    NEW.member_id,
    'match_player_availability'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_match_player_availability ON public.match_player_availability;
CREATE TRIGGER trg_validate_match_player_availability
  BEFORE INSERT OR UPDATE OF match_id, team_id, member_id
  ON public.match_player_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_match_player_availability();

CREATE OR REPLACE FUNCTION public.trg_validate_match_lineups()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.fn_validate_match_member_assignment(
    NEW.match_id,
    NEW.team_id,
    NEW.member_id,
    'match_lineups'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_match_lineups ON public.match_lineups;
CREATE TRIGGER trg_validate_match_lineups
  BEFORE INSERT OR UPDATE OF match_id, team_id, member_id
  ON public.match_lineups
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_match_lineups();

-- ---------------------------------------------------------------------------
-- 3) Bei Team-/Phasenwechsel im Spiel bestehende Datensätze neu validieren
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_revalidate_match_assignments_on_match_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
BEGIN
  IF (OLD.team_id IS DISTINCT FROM NEW.team_id)
     OR (OLD.season_phase_id IS DISTINCT FROM NEW.season_phase_id) THEN

    FOR rec IN
      SELECT member_id, team_id FROM public.match_player_availability WHERE match_id = NEW.id
    LOOP
      PERFORM public.fn_validate_match_member_assignment(
        NEW.id,
        rec.team_id,
        rec.member_id,
        'schedule_matches(change)->match_player_availability'
      );
    END LOOP;

    FOR rec IN
      SELECT member_id, team_id FROM public.match_lineups WHERE match_id = NEW.id
    LOOP
      PERFORM public.fn_validate_match_member_assignment(
        NEW.id,
        rec.team_id,
        rec.member_id,
        'schedule_matches(change)->match_lineups'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_revalidate_match_assignments_on_match_change ON public.schedule_matches;
CREATE TRIGGER trg_revalidate_match_assignments_on_match_change
  BEFORE UPDATE OF team_id, season_phase_id
  ON public.schedule_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_revalidate_match_assignments_on_match_change();

-- ---------------------------------------------------------------------------
-- 4) RLS-Schreibrechte explizit für trainer/vorstand/admin
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS availability_write ON public.match_player_availability;
CREATE POLICY availability_write ON public.match_player_availability
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'vorstand', 'trainer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'vorstand', 'trainer')
    )
  );

DROP POLICY IF EXISTS lineup_write ON public.match_lineups;
CREATE POLICY lineup_write ON public.match_lineups
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'vorstand', 'trainer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'vorstand', 'trainer')
    )
  );
