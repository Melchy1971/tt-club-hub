-- Team-bezogene Indizes für häufige Abfragen
--
-- Analyse: Die folgenden Queries sind die heißesten Pfade:
--   1. Alle aktiven Teams einer Saison   → WHERE season_id = ? AND is_active = true
--   2. Kaderliste sortiert nach Position → WHERE team_id = ? ORDER BY position
--   3. Alle Teamzugehörigkeiten eines Spielers → WHERE member_id = ?
--
-- Bereits vorhanden (keine Duplikate):
--   idx_teams_season_id          ON teams(season_id)
--   idx_teams_active             ON teams(is_active)
--   idx_team_members_member      ON team_members(member_id)
--   UNIQUE(team_id, member_id)   impliziter Index auf team_members(team_id, member_id)
--   UNIQUE(team_id, position)    impliziter Index auf team_members(team_id, position)

-- 1) Composite-Index für "aktive Teams in einer Saison"
--    Deckt: SELECT * FROM teams WHERE season_id = ? AND is_active = true ORDER BY name
--    Ohne diesen Index wäre ein Bitmap-AND aus zwei Einzel-Indizes nötig.
CREATE INDEX IF NOT EXISTS idx_teams_season_active
  ON public.teams(season_id, is_active);

-- 2) Partial-Index für aktive Teams (häufigster Filter)
--    Deckt: SELECT * FROM teams WHERE season_id = ? AND is_active = true
--    Kleiner als ein vollständiger Index, da nur ~aktive Zeilen.
CREATE INDEX IF NOT EXISTS idx_teams_season_active_only
  ON public.teams(season_id)
  WHERE is_active = true;

-- 3) Composite-Index für Mitglied-Team-Lookup mit Saison-Join
--    Deckt: team_members JOIN teams ON ... WHERE team_members.member_id = ? AND teams.season_id = ?
--    Ermöglicht Index-Scan anstatt Seq-Scan auf team_members beim Saison-Filter.
--    Hinweis: Der bestehende idx_team_members_member reicht für member_id allein;
--    dieser Index beschleunigt zusätzlich den Nested-Loop mit teams.
CREATE INDEX IF NOT EXISTS idx_team_members_member_team
  ON public.team_members(member_id, team_id);

-- 4) Unique-Constraint auf (team_id, member_id) erzeugt bereits einen B-Tree-Index.
--    Derselbe Index wird für Upsert ON CONFLICT(team_id, member_id) genutzt. Kein Duplikat nötig.

-- 5) members: Composite auf (is_active, ttr_rating) für Kaderauswahl-Queries
--    Deckt: SELECT * FROM members WHERE is_active = true ORDER BY ttr_rating DESC
CREATE INDEX IF NOT EXISTS idx_members_active_ttr
  ON public.members(is_active, ttr_rating DESC NULLS LAST)
  WHERE is_active = true;
