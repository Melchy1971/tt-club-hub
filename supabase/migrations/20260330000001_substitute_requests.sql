-- ============================================================================
-- Ersatzspieler-Anfragen (substitute_requests)
-- ============================================================================
-- Status-Workflow:
--
--   pending ──► accepted  (Spieler/Trainer bestätigt)
--           ──► declined  (Spieler/Trainer lehnt ab)
--           ──► cancelled (Anfragesteller zieht zurück)
--   accepted ──► cancelled (nur vor match_date möglich – DB-Trigger warnt)
--
-- Erlaubte Übergänge (DB: fn_check_substitute_status_transition):
--   pending  → accepted, declined, cancelled
--   accepted → cancelled
--   declined → (keine weiteren)
--   cancelled → (keine weiteren)
--
-- Konflikt-Prüfung (DB-Trigger fn_check_substitute_conflicts):
--   1. Spieler bereits ACCEPTED für dasselbe Spiel → EXCEPTION
--   2. Spieler bereits PENDING für dasselbe Spiel → EXCEPTION
--   3. Anfragendes Team gehört nicht zur Saison des Spiels → EXCEPTION
-- ============================================================================

CREATE TYPE public.substitute_request_status AS ENUM (
  'pending',    -- Anfrage gestellt, wartet auf Antwort
  'accepted',   -- Spieler hat zugesagt
  'declined',   -- Spieler hat abgesagt
  'cancelled'   -- Anfragesteller hat zurückgezogen
);

-- ─── Haupttabelle ─────────────────────────────────────────────────────────────

CREATE TABLE public.substitute_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Welches Spiel braucht einen Ersatz?
  match_id        UUID        NOT NULL REFERENCES public.schedule_matches(id) ON DELETE CASCADE,
  -- Welche Mannschaft fragt an?
  requesting_team_id UUID     NOT NULL REFERENCES public.teams(id)            ON DELETE CASCADE,
  -- Wer wird als Ersatz angefragt?
  substitute_member_id UUID   NOT NULL REFERENCES public.members(id)          ON DELETE CASCADE,

  status          public.substitute_request_status NOT NULL DEFAULT 'pending',

  -- Wer hat die Anfrage gestellt? (auth.users-ID für Audit-Trail)
  requested_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Wer hat entschieden? (accept/decline/cancel)
  resolved_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ,

  -- Freitext: Grund der Anfrage (für Spieler sichtbar)
  note            TEXT        CHECK (char_length(note) <= 500),
  -- Freitext: Begründung der Ablehnung / Absage
  resolution_note TEXT        CHECK (char_length(resolution_note) <= 500),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Verhindert Doppel-Anfragen für denselben Spieler+Spiel in offenem Status:
  -- Soft-unique: nur ein pending/accepted-Eintrag pro Spieler+Spiel.
  -- declined und cancelled dürfen mehrfach vorkommen (Neuanfrage möglich).
  CONSTRAINT uq_substitute_active
    UNIQUE NULLS NOT DISTINCT (match_id, substitute_member_id, status)
    -- Hinweis: diese Formulierung funktioniert in PG 15+.
    -- Für PG 14 (Supabase default): Partial Unique Index unten verwenden.
);

-- Partial Unique Index für PG 14-Kompatibilität (ergänzt den UNIQUE-Constraint oben)
-- Sicherheitshalber beide definieren; PG 15 macht den Index redundant aber harmlos.
CREATE UNIQUE INDEX IF NOT EXISTS uq_substitute_pending
  ON public.substitute_requests(match_id, substitute_member_id)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS uq_substitute_accepted
  ON public.substitute_requests(match_id, substitute_member_id)
  WHERE status = 'accepted';

-- ─── updated_at-Trigger ──────────────────────────────────────────────────────

CREATE TRIGGER update_substitute_requests_updated_at
  BEFORE UPDATE ON public.substitute_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Status-Übergangs-Validierung ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_check_substitute_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Nur bei Status-Änderungen prüfen
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Erlaubte Übergänge
  IF OLD.status = 'pending' AND NEW.status IN ('accepted', 'declined', 'cancelled') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'accepted' AND NEW.status = 'cancelled' THEN
    -- Warnung wenn Spiel bereits stattgefunden hat
    IF EXISTS (
      SELECT 1 FROM public.schedule_matches
      WHERE id = NEW.match_id AND match_date < CURRENT_DATE
    ) THEN
      RAISE WARNING
        'Bestätigte Anfrage % wird nach dem Spieltermin storniert', NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  -- Alle anderen Übergänge verbieten
  RAISE EXCEPTION
    'Ungültiger Status-Übergang: % → % für substitute_request %',
    OLD.status, NEW.status, NEW.id;
END;
$$;

CREATE TRIGGER trg_check_substitute_status_transition
  BEFORE UPDATE ON public.substitute_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_substitute_status_transition();

-- ─── Konsistenz-Prüfung bei INSERT ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_check_substitute_conflicts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  match_season_id UUID;
  team_season_id  UUID;
BEGIN
  -- 1. Saison-Konsistenz: Team muss zur selben Saison wie das Spiel gehören
  SELECT season_id INTO match_season_id
    FROM public.schedule_matches WHERE id = NEW.match_id;
  SELECT season_id INTO team_season_id
    FROM public.teams WHERE id = NEW.requesting_team_id;

  IF match_season_id IS DISTINCT FROM team_season_id THEN
    RAISE EXCEPTION
      'Team % gehört zu Saison %, Spiel % gehört zu Saison % — Saison-Konflikt',
      NEW.requesting_team_id, team_season_id, NEW.match_id, match_season_id;
  END IF;

  -- 2. Spieler ist bereits Stammspieler des anfragenden Teams
  IF EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = NEW.requesting_team_id
      AND member_id = NEW.substitute_member_id
  ) THEN
    RAISE EXCEPTION
      'Spieler % ist bereits im Kader von Team % und kann nicht als Ersatz angefragt werden',
      NEW.substitute_member_id, NEW.requesting_team_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_substitute_conflicts
  BEFORE INSERT ON public.substitute_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_substitute_conflicts();

-- ─── resolved_at automatisch setzen ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_set_substitute_resolved_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('accepted', 'declined', 'cancelled')
     AND OLD.status = 'pending'
     AND NEW.resolved_at IS NULL
  THEN
    NEW.resolved_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_substitute_resolved_at
  BEFORE UPDATE ON public.substitute_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_substitute_resolved_at();

-- ─── Indizes ─────────────────────────────────────────────────────────────────

-- Offene Anfragen pro Spiel (häufigster Read-Pfad)
CREATE INDEX idx_substitute_match_status
  ON public.substitute_requests(match_id, status);

-- Anfragen für einen Spieler (Spieler-Dashboard)
CREATE INDEX idx_substitute_member
  ON public.substitute_requests(substitute_member_id);

-- Anfragen eines Teams (Trainer-Dashboard)
CREATE INDEX idx_substitute_team_status
  ON public.substitute_requests(requesting_team_id, status);

-- Offene Anfragen global (Admin-Übersicht)
CREATE INDEX idx_substitute_pending
  ON public.substitute_requests(status, created_at DESC)
  WHERE status = 'pending';

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.substitute_requests ENABLE ROW LEVEL SECURITY;

-- Lesen: alle authentifizierten Nutzer
CREATE POLICY substitute_select ON public.substitute_requests
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Anfrage stellen: spieler + trainer + höher
CREATE POLICY substitute_insert ON public.substitute_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'developer', 'vorstand', 'trainer', 'spieler')
    )
  );

-- Status ändern: trainer + höher (approve) oder eigene Anfrage (cancel)
CREATE POLICY substitute_update ON public.substitute_requests
  FOR UPDATE USING (
    -- Trainer/Admin dürfen alles
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'developer', 'vorstand', 'trainer')
    )
    OR
    -- Anfragesteller darf nur canceln
    (requested_by = auth.uid())
  );
