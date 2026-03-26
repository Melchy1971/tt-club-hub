
-- ============================================
-- TT-Manager Pro: Grundlegendes Datenmodell
-- ============================================

-- === ENUMS ===
CREATE TYPE public.app_role AS ENUM ('admin', 'vorstand', 'trainer', 'spieler', 'mitglied', 'developer');
CREATE TYPE public.age_group AS ENUM ('herren', 'damen', 'jungen_18', 'maedchen_18', 'jungen_15', 'maedchen_15', 'jungen_13', 'maedchen_13', 'jungen_11', 'maedchen_11', 'senioren', 'seniorinnen');
CREATE TYPE public.match_status AS ENUM ('geplant', 'laufend', 'beendet', 'verschoben', 'abgesagt');
CREATE TYPE public.gender AS ENUM ('maennlich', 'weiblich', 'divers');

-- === TIMESTAMP TRIGGER FUNCTION ===
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- === ROLES (Systemrollen-Tabelle) ===
CREATE TABLE public.roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name public.app_role NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Roles sind für alle authentifizierten Nutzer lesbar"
  ON public.roles FOR SELECT TO authenticated USING (true);

-- === SEASONS (Saisons) ===
CREATE TABLE public.seasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_season_dates CHECK (end_date > start_date)
);

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Seasons sind für alle authentifizierten Nutzer lesbar"
  ON public.seasons FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_seasons_updated_at
  BEFORE UPDATE ON public.seasons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- === VENUES (Spielstätten) ===
CREATE TABLE public.venues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  street TEXT,
  zip_code TEXT,
  city TEXT,
  notes TEXT,
  is_home_venue BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venues sind für alle authentifizierten Nutzer lesbar"
  ON public.venues FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- === MEMBERS (Vereinsmitglieder) ===
CREATE TABLE public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date_of_birth DATE,
  gender public.gender,
  street TEXT,
  zip_code TEXT,
  city TEXT,
  member_number TEXT UNIQUE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  exit_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  ttr_rating INTEGER,
  qttr_rating INTEGER,
  age_group public.age_group,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_member_dates CHECK (exit_date IS NULL OR exit_date >= entry_date),
  CONSTRAINT valid_ttr CHECK (ttr_rating IS NULL OR (ttr_rating >= 0 AND ttr_rating <= 3000)),
  CONSTRAINT valid_qttr CHECK (qttr_rating IS NULL OR (qttr_rating >= 0 AND qttr_rating <= 3000))
);

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members sind für alle authentifizierten Nutzer lesbar"
  ON public.members FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_members_user_id ON public.members(user_id);
CREATE INDEX idx_members_is_active ON public.members(is_active);
CREATE INDEX idx_members_last_name ON public.members(last_name);

CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- === USER_ROLES (Rollenzuweisung) ===
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User_roles lesbar für authentifizierte Nutzer"
  ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

-- === SECURITY DEFINER: has_role ===
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- === TEAMS (Mannschaften) ===
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE RESTRICT,
  league TEXT,
  division TEXT,
  age_group public.age_group NOT NULL DEFAULT 'herren',
  captain_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams sind für alle authentifizierten Nutzer lesbar"
  ON public.teams FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_teams_season_id ON public.teams(season_id);

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- === TEAM_MEMBERS (Mannschaftsaufstellung) ===
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, member_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team_members sind für alle authentifizierten Nutzer lesbar"
  ON public.team_members FOR SELECT TO authenticated USING (true);

-- === SCHEDULE_MATCHES (Begegnungen/Spielplan) ===
CREATE TABLE public.schedule_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE RESTRICT,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  match_day INTEGER,
  match_date DATE NOT NULL,
  match_time TIME,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  is_home BOOLEAN NOT NULL DEFAULT true,
  status public.match_status NOT NULL DEFAULT 'geplant',
  report_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_scores CHECK (
    (home_score IS NULL AND away_score IS NULL) OR
    (home_score >= 0 AND away_score >= 0)
  )
);

ALTER TABLE public.schedule_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schedule_matches sind für alle authentifizierten Nutzer lesbar"
  ON public.schedule_matches FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_schedule_matches_season ON public.schedule_matches(season_id);
CREATE INDEX idx_schedule_matches_team ON public.schedule_matches(team_id);
CREATE INDEX idx_schedule_matches_date ON public.schedule_matches(match_date);

CREATE TRIGGER update_schedule_matches_updated_at
  BEFORE UPDATE ON public.schedule_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- === CLUB_SETTINGS (Vereinseinstellungen) ===
CREATE TABLE public.club_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_name TEXT NOT NULL DEFAULT 'Mein Tischtennisverein',
  club_number TEXT,
  association TEXT,
  logo_url TEXT,
  primary_color TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  street TEXT,
  zip_code TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.club_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club_settings sind für alle authentifizierten Nutzer lesbar"
  ON public.club_settings FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_club_settings_updated_at
  BEFORE UPDATE ON public.club_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- === WRITE POLICIES (rollenbasiert) ===

CREATE POLICY "Members schreibbar für Admin/Vorstand/Trainer"
  ON public.members FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vorstand') OR public.has_role(auth.uid(), 'trainer'));

CREATE POLICY "Members aktualisierbar für Admin/Vorstand/Trainer"
  ON public.members FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vorstand') OR public.has_role(auth.uid(), 'trainer'));

CREATE POLICY "Members löschbar für Admin/Vorstand"
  ON public.members FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vorstand'));

CREATE POLICY "Teams schreibbar für Admin/Vorstand"
  ON public.teams FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vorstand'));

CREATE POLICY "Teams aktualisierbar für Admin/Vorstand/Trainer"
  ON public.teams FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vorstand') OR public.has_role(auth.uid(), 'trainer'));

CREATE POLICY "Teams löschbar für Admin/Vorstand"
  ON public.teams FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vorstand'));

CREATE POLICY "Team_members schreibbar für Admin/Vorstand/Trainer"
  ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vorstand') OR public.has_role(auth.uid(), 'trainer'));

CREATE POLICY "Team_members löschbar für Admin/Vorstand/Trainer"
  ON public.team_members FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vorstand') OR public.has_role(auth.uid(), 'trainer'));

CREATE POLICY "Schedule_matches schreibbar für Admin/Vorstand/Trainer"
  ON public.schedule_matches FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vorstand') OR public.has_role(auth.uid(), 'trainer'));

CREATE POLICY "Schedule_matches aktualisierbar für Admin/Vorstand/Trainer"
  ON public.schedule_matches FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vorstand') OR public.has_role(auth.uid(), 'trainer'));

CREATE POLICY "Schedule_matches löschbar für Admin/Vorstand"
  ON public.schedule_matches FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vorstand'));

CREATE POLICY "Seasons schreibbar für Admin/Vorstand"
  ON public.seasons FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vorstand'));

CREATE POLICY "Seasons aktualisierbar für Admin/Vorstand"
  ON public.seasons FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vorstand'));

CREATE POLICY "Venues schreibbar für Admin/Vorstand"
  ON public.venues FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vorstand'));

CREATE POLICY "Venues aktualisierbar für Admin/Vorstand"
  ON public.venues FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vorstand'));

CREATE POLICY "Club_settings schreibbar für Admin"
  ON public.club_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Club_settings aktualisierbar für Admin"
  ON public.club_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "User_roles schreibbar für Admin"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "User_roles löschbar für Admin"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- === SEED: Systemrollen ===
INSERT INTO public.roles (name, display_name, description) VALUES
  ('admin', 'Administrator', 'Vollzugriff auf alle Funktionen'),
  ('vorstand', 'Vorstand', 'Vereinsvorstand mit erweiterten Rechten'),
  ('trainer', 'Trainer', 'Mannschafts- und Spielerverwaltung'),
  ('spieler', 'Spieler', 'Aktiver Spieler mit Zugriff auf eigene Daten'),
  ('mitglied', 'Mitglied', 'Passives Vereinsmitglied mit Lesezugriff'),
  ('developer', 'Entwickler', 'Technischer Zugriff für Entwicklung');
