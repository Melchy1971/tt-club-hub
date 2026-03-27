-- Incremental schema hardening & normalization
-- Focus: members, teams, seasons, schedule_matches, user_roles, roles, venues, club_settings

-- 1) Seasons: eindeutige Namen, keine Überlappungen, genau eine aktuelle Saison
ALTER TABLE public.seasons
  ADD CONSTRAINT uq_seasons_name UNIQUE (name);

-- benötigt btree_gist Extension für EXCLUDE mit daterange; bei Supabase meist aktiv
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_no_overlap
  EXCLUDE USING gist (daterange(start_date, end_date, '[]') WITH &&);

CREATE UNIQUE INDEX IF NOT EXISTS uq_seasons_one_current
  ON public.seasons(is_current)
  WHERE is_current;

-- 2) Teams: verhindern Dubletten pro Saison
ALTER TABLE public.teams
  ADD CONSTRAINT uq_teams_per_season UNIQUE (season_id, name);

-- 3) Team-Members: eindeutige Position pro Team (0 = keine feste Position)
ALTER TABLE public.team_members
  ADD CONSTRAINT uq_team_member_position UNIQUE (team_id, position);

ALTER TABLE public.team_members
  ADD CONSTRAINT chk_team_member_position CHECK (position >= 0);

-- 4) Schedule_matches: FK-basierte Heim/Auswärts-Referenzen + Datum in Saison
ALTER TABLE public.schedule_matches
  ADD COLUMN home_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN away_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- Übergangsphase: erlauben entweder Text oder FK, aber nicht beides leer
ALTER TABLE public.schedule_matches
  ADD CONSTRAINT chk_schedule_match_team_refs
    CHECK (
      (home_team IS NOT NULL OR home_team_id IS NOT NULL) AND
      (away_team IS NOT NULL OR away_team_id IS NOT NULL)
    );

-- Saison-Gültigkeit des Spieltermins
CREATE OR REPLACE FUNCTION public.fn_check_match_in_season()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  season_record RECORD;
BEGIN
  SELECT start_date, end_date INTO season_record FROM public.seasons WHERE id = NEW.season_id;
  IF season_record IS NULL THEN
    RAISE EXCEPTION 'Season % not found', NEW.season_id;
  END IF;
  IF NEW.match_date < season_record.start_date OR NEW.match_date > season_record.end_date THEN
    RAISE EXCEPTION 'match_date % liegt außerhalb der Saison % (% - %)',
      NEW.match_date, NEW.season_id, season_record.start_date, season_record.end_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_match_in_season ON public.schedule_matches;
CREATE TRIGGER trg_check_match_in_season
  BEFORE INSERT OR UPDATE ON public.schedule_matches
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_match_in_season();

-- 5) Club_settings: Singleton absichern
ALTER TABLE public.club_settings
  ADD CONSTRAINT chk_club_settings_singleton CHECK (id = '00000000-0000-0000-0000-000000000001');

-- 6) Rollenmodell konsistent: user_roles → FK auf roles(name)
ALTER TABLE public.user_roles
  ADD CONSTRAINT fk_user_roles_role
  FOREIGN KEY (role) REFERENCES public.roles(name) ON DELETE RESTRICT;

-- 7) Datenschutz-Vorbereitung: optional separate PII-Tabelle (nur Struktur)
CREATE TABLE IF NOT EXISTS public.member_private (
  member_id UUID PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  street TEXT,
  zip_code TEXT,
  city TEXT,
  phone TEXT,
  email TEXT,
  date_of_birth DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_member_private_updated_at
  BEFORE UPDATE ON public.member_private
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) Indizes für häufige Abfragen
CREATE INDEX IF NOT EXISTS idx_team_members_member ON public.team_members(member_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_assigned_by ON public.user_roles(assigned_by);
CREATE INDEX IF NOT EXISTS idx_teams_active ON public.teams(is_active);
CREATE INDEX IF NOT EXISTS idx_schedule_matches_season_team_date
  ON public.schedule_matches(season_id, team_id, match_date);
CREATE INDEX IF NOT EXISTS idx_schedule_matches_venue ON public.schedule_matches(venue_id);
CREATE INDEX IF NOT EXISTS idx_members_name ON public.members(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_seasons_is_current ON public.seasons(is_current) WHERE is_current;

-- 9) Platzhalter für Training & Board (für spätere Features, keine FK-Kollisionen)
CREATE TABLE IF NOT EXISTS public.training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts   TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_training_duration CHECK (end_ts > start_ts)
);

CREATE TRIGGER update_training_sessions_updated_at
  BEFORE UPDATE ON public.training_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.board_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  since DATE NOT NULL DEFAULT CURRENT_DATE,
  until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_board_until CHECK (until IS NULL OR until >= since)
);

CREATE TRIGGER update_board_positions_updated_at
  BEFORE UPDATE ON public.board_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
