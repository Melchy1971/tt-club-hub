-- ============================================================================
-- Verfügbarkeit & Aufstellung
-- Tabellen: match_player_availability, match_lineups
-- Enum:     availability_status
-- ============================================================================

-- ─── Enum ────────────────────────────────────────────────────────────────────

CREATE TYPE public.availability_status AS ENUM (
  'unknown',       -- Spieler hat noch nicht reagiert (Default)
  'available',     -- Zugesagt
  'unavailable',   -- Abgesagt (Verletzung, Urlaub, …)
  'uncertain'      -- Unsicher / vorläufig
);

-- ─── Verfügbarkeit ───────────────────────────────────────────────────────────
-- Zeigt pro Spiel und Spieler an, ob der Spieler verfügbar ist.
-- Scope: (match_id, member_id) – ein Eintrag pro Spieler pro Spiel.
-- team_id ist denormalisiert für schnelle Abfragen ohne JOIN auf schedule_matches.

CREATE TABLE public.match_player_availability (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     UUID        NOT NULL REFERENCES public.schedule_matches(id) ON DELETE CASCADE,
  member_id    UUID        NOT NULL REFERENCES public.members(id)          ON DELETE CASCADE,
  team_id      UUID        NOT NULL REFERENCES public.teams(id)            ON DELETE CASCADE,
  status       public.availability_status NOT NULL DEFAULT 'unknown',
  note         TEXT        CHECK (char_length(note) <= 500),
  updated_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ein Spieler hat pro Spiel genau einen Availability-Eintrag
  CONSTRAINT uq_availability_match_member UNIQUE (match_id, member_id)
);

-- Trigger: updated_at automatisch setzen
CREATE TRIGGER update_match_player_availability_updated_at
  BEFORE UPDATE ON public.match_player_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indizes
-- (match_id) → alle Spieler für ein Spiel laden
CREATE INDEX idx_availability_match      ON public.match_player_availability(match_id);
-- (member_id) → Verlauf eines Spielers über mehrere Spiele
CREATE INDEX idx_availability_member     ON public.match_player_availability(member_id);
-- (team_id, status) → Dashboard: "Wie viele Spieler sind verfügbar?"
CREATE INDEX idx_availability_team_status ON public.match_player_availability(team_id, status);

-- RLS: nur Vereinsmitglieder lesen; Schreiben erfordert mindestens trainer-Rolle
ALTER TABLE public.match_player_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY availability_select ON public.match_player_availability
  FOR SELECT USING (true);  -- ggf. auf auth.role() einschränken

CREATE POLICY availability_write ON public.match_player_availability
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'vorstand', 'trainer')
    )
  );

-- ─── Aufstellung ─────────────────────────────────────────────────────────────
-- Legt die konkrete Spieleraufstellung für ein Spiel fest.
-- position: 1-6 Einzel (DTTB-Format), 7-8 Doppel-Paar-Slots
--           Bei kleineren Ligen: 1-4 Einzel, 5-6 Doppel
-- is_substitute: Ersatzspieler (zählt nicht zur Stammaufstellung)
--
-- Constraint-Design:
--   UNIQUE(match_id, position)  → jede Aufstellungsposition nur einmal pro Spiel
--   UNIQUE(match_id, member_id) → ein Spieler pro Spiel nur einmal in Aufstellung
--   FK member_id → members      → keine Geister-Spieler (kein FK auf team_members,
--                                 weil Spieler nach Saisonwechsel historisch bleiben)

CREATE TABLE public.match_lineups (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      UUID        NOT NULL REFERENCES public.schedule_matches(id) ON DELETE CASCADE,
  team_id       UUID        NOT NULL REFERENCES public.teams(id)            ON DELETE CASCADE,
  member_id     UUID        NOT NULL REFERENCES public.members(id)          ON DELETE CASCADE,
  -- Position 1-9 (Einzel + Doppel-Slots); 0 ist verboten (kein "ohne Position")
  position      SMALLINT    NOT NULL CHECK (position >= 1 AND position <= 9),
  is_substitute BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_lineup_match_position UNIQUE (match_id, position),
  CONSTRAINT uq_lineup_match_member   UNIQUE (match_id, member_id)
);

CREATE TRIGGER update_match_lineups_updated_at
  BEFORE UPDATE ON public.match_lineups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indizes
CREATE INDEX idx_lineup_match  ON public.match_lineups(match_id);
CREATE INDEX idx_lineup_member ON public.match_lineups(member_id);
-- (team_id, match_id) → alle Spiele einer Mannschaft mit Aufstellung
CREATE INDEX idx_lineup_team_match ON public.match_lineups(team_id, match_id);

ALTER TABLE public.match_lineups ENABLE ROW LEVEL SECURITY;

CREATE POLICY lineup_select ON public.match_lineups
  FOR SELECT USING (true);

CREATE POLICY lineup_write ON public.match_lineups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'vorstand', 'trainer')
    )
  );

-- ─── DB-seitige Konsistenz-Funktion ──────────────────────────────────────────
-- Warnt (via NOTICE) wenn ein Spieler in match_lineups eingetragen wird,
-- der NICHT im team_members-Kader für das zugehörige Team steht.
-- RAISE WARNING statt EXCEPTION → blockiert nicht, gibt aber Hinweis zurück.

CREATE OR REPLACE FUNCTION public.fn_warn_lineup_not_in_roster()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id  = NEW.team_id
      AND member_id = NEW.member_id
  ) THEN
    RAISE WARNING
      'Spieler % ist nicht im Kader von Team % (match_lineups insert)',
      NEW.member_id, NEW.team_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_warn_lineup_not_in_roster
  BEFORE INSERT OR UPDATE ON public.match_lineups
  FOR EACH ROW EXECUTE FUNCTION public.fn_warn_lineup_not_in_roster();
