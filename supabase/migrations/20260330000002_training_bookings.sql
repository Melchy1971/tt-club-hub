-- ============================================================================
-- Training Bookings
-- Härtung: training_sessions  + neue Tabelle training_bookings
-- ============================================================================
--
-- Modell-Überblick:
--   training_sessions  – geplante Trainingseinheit (Zeitslot, Ort, Kapazität)
--   training_bookings  – Reservierung eines Mitglieds für eine Einheit
--
-- Buchungs-Status:
--   pending    → Anfrage gestellt (bei manueller Bestätigung)
--   confirmed  → Bestätigt (manuell oder auto-confirm bei freier Kapazität)
--   waitlisted → Kapazität voll, auf Warteliste
--   cancelled  → Storniert (durch Mitglied oder Trainer)
--
-- Konsistenz-Trigger (Übersicht):
--   fn_check_booking_conflicts  → INSERT: Doppelbuchung, Partner-Kollision,
--                                          veraltete/stornierte Session
--   fn_check_session_capacity   → INSERT: Auto-Waitlist wenn max_participants erreicht
--   fn_check_booking_cancel     → UPDATE: Stornierung vergangener Sessions warnen
--   fn_set_booking_cancelled_at → UPDATE: cancelled_at automatisch setzen
--   fn_check_requester_partner  → INSERT/UPDATE: requester != partner
-- ============================================================================

-- ─── training_sessions härten ─────────────────────────────────────────────────

-- Maximale Teilnehmer (NULL = unbegrenzt)
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS max_participants SMALLINT CHECK (max_participants IS NULL OR max_participants > 0),
  ADD COLUMN IF NOT EXISTS is_cancelled     BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS title            TEXT      CHECK (char_length(title) <= 200),
  ADD COLUMN IF NOT EXISTS description      TEXT      CHECK (char_length(description) <= 1000),
  -- Wer hat die Session erstellt (für Schreibrechte)
  ADD COLUMN IF NOT EXISTS created_by       UUID      REFERENCES auth.users(id) ON DELETE SET NULL;

-- Kapazitäts-Plausibilität
ALTER TABLE public.training_sessions
  ADD CONSTRAINT chk_training_max_participants
    CHECK (max_participants IS NULL OR max_participants BETWEEN 1 AND 100);

-- ─── Booking-Status-Enum ─────────────────────────────────────────────────────

CREATE TYPE public.booking_status AS ENUM (
  'pending',      -- Anfrage offen
  'confirmed',    -- Bestätigt
  'waitlisted',   -- Warteliste
  'cancelled'     -- Storniert
);

-- ─── training_bookings ────────────────────────────────────────────────────────

CREATE TABLE public.training_bookings (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID         NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,

  -- Wer bucht?
  requester_id   UUID         NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  -- Optionaler Trainingspartner (z.B. Doppel-Training)
  partner_id     UUID         REFERENCES public.members(id) ON DELETE SET NULL,

  status         public.booking_status NOT NULL DEFAULT 'pending',

  -- Audit
  booked_by      UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_by   UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_at   TIMESTAMPTZ,

  note           TEXT         CHECK (char_length(note) <= 500),
  -- Notiz bei Ablehnung / Stornierung
  cancel_reason  TEXT         CHECK (char_length(cancel_reason) <= 500),

  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- Ein Mitglied kann pro Session nur einmal als requester stehen
  CONSTRAINT uq_booking_session_requester UNIQUE (session_id, requester_id),

  -- Requester und Partner müssen unterschiedlich sein
  CONSTRAINT chk_booking_requester_not_partner
    CHECK (partner_id IS NULL OR partner_id <> requester_id)
);

-- updated_at-Trigger
CREATE TRIGGER update_training_bookings_updated_at
  BEFORE UPDATE ON public.training_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── cancelled_at automatisch setzen ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_set_booking_cancelled_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' AND NEW.cancelled_at IS NULL THEN
    NEW.cancelled_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_booking_cancelled_at
  BEFORE UPDATE ON public.training_bookings
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_booking_cancelled_at();

-- ─── Konsistenz-Trigger: INSERT-Konflikte ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_check_booking_conflicts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  sess RECORD;
BEGIN
  -- 1. Session existiert und ist nicht storniert
  SELECT start_ts, end_ts, is_cancelled INTO sess
    FROM public.training_sessions WHERE id = NEW.session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Training-Session % nicht gefunden', NEW.session_id;
  END IF;

  IF sess.is_cancelled THEN
    RAISE EXCEPTION 'Training-Session % ist storniert — keine Buchungen möglich', NEW.session_id;
  END IF;

  -- 2. Session liegt nicht vollständig in der Vergangenheit
  IF sess.end_ts < now() THEN
    RAISE EXCEPTION
      'Training-Session % hat bereits stattgefunden (Ende: %)',
      NEW.session_id, sess.end_ts;
  END IF;

  -- 3. partner_id ist nicht bereits als requester in dieser Session aktiv
  IF NEW.partner_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.training_bookings
      WHERE session_id   = NEW.session_id
        AND requester_id = NEW.partner_id
        AND status NOT IN ('cancelled')
    ) THEN
      RAISE EXCEPTION
        'Partner (%) ist für diese Session bereits als eigenständiger Teilnehmer gebucht',
        NEW.partner_id;
    END IF;

    -- 4. partner_id taucht nicht bereits als partner_id einer anderen aktiven Buchung auf
    IF EXISTS (
      SELECT 1 FROM public.training_bookings
      WHERE session_id  = NEW.session_id
        AND partner_id  = NEW.partner_id
        AND status NOT IN ('cancelled')
        AND id <> COALESCE(NEW.id, gen_random_uuid())   -- UPDATE-safe
    ) THEN
      RAISE EXCEPTION
        'Partner (%) ist für diese Session bereits als Partner einer anderen Buchung eingetragen',
        NEW.partner_id;
    END IF;
  END IF;

  -- 5. requester_id taucht nicht als partner_id einer anderen aktiven Buchung auf
  IF EXISTS (
    SELECT 1 FROM public.training_bookings
    WHERE session_id = NEW.session_id
      AND partner_id = NEW.requester_id
      AND status NOT IN ('cancelled')
  ) THEN
    RAISE EXCEPTION
      'Mitglied (%) ist für diese Session bereits als Partner einer anderen Buchung eingetragen',
      NEW.requester_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_booking_conflicts
  BEFORE INSERT ON public.training_bookings
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_booking_conflicts();

-- ─── Kapazitäts-Trigger: Auto-Waitlist ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_check_session_capacity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  max_p    SMALLINT;
  active_c INTEGER;
BEGIN
  -- Nur bei neuen pending/confirmed-Buchungen prüfen
  IF NEW.status NOT IN ('pending', 'confirmed') THEN
    RETURN NEW;
  END IF;

  SELECT max_participants INTO max_p
    FROM public.training_sessions WHERE id = NEW.session_id;

  -- NULL = unbegrenzt
  IF max_p IS NULL THEN
    RETURN NEW;
  END IF;

  -- Anzahl aktiver Buchungen (pending + confirmed + waitlisted)
  SELECT COUNT(*) INTO active_c
    FROM public.training_bookings
    WHERE session_id = NEW.session_id
      AND status IN ('pending', 'confirmed', 'waitlisted');

  -- Jede Buchung zählt als 1 Platz (partner_id belegt keinen extra Slot,
  -- da sie kein eigenes Mitglied der Session ist — nur unterstützend)
  IF active_c >= max_p THEN
    -- Automatisch auf Warteliste setzen statt ablehnen
    NEW.status = 'waitlisted';
    RAISE NOTICE
      'Session % ist voll (% / %). Buchung % auf Warteliste gesetzt.',
      NEW.session_id, active_c, max_p, NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_session_capacity
  BEFORE INSERT ON public.training_bookings
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_session_capacity();

-- ─── Warnung bei Stornierung vergangener Sessions ─────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_check_booking_cancel()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    IF EXISTS (
      SELECT 1 FROM public.training_sessions
      WHERE id = NEW.session_id AND end_ts < now()
    ) THEN
      RAISE WARNING
        'Buchung % für eine vergangene Session wird storniert', NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_booking_cancel
  BEFORE UPDATE ON public.training_bookings
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_booking_cancel();

-- ─── Indizes ─────────────────────────────────────────────────────────────────

-- Alle Buchungen einer Session (Trainer-Ansicht)
CREATE INDEX idx_booking_session_status
  ON public.training_bookings(session_id, status);

-- Alle Buchungen eines Mitglieds (Spieler-Dashboard)
CREATE INDEX idx_booking_requester
  ON public.training_bookings(requester_id);

-- Partner-Lookup (für Konflikt-Queries und Spieler-Dashboard)
CREATE INDEX idx_booking_partner
  ON public.training_bookings(partner_id)
  WHERE partner_id IS NOT NULL;

-- Offene Anfragen (Admin-Übersicht)
CREATE INDEX idx_booking_pending
  ON public.training_bookings(status, created_at DESC)
  WHERE status = 'pending';

-- Warteliste (für Nachrücken-Logik)
CREATE INDEX idx_booking_waitlist
  ON public.training_bookings(session_id, created_at ASC)
  WHERE status = 'waitlisted';

-- Sessions: zukünftige aktive (häufigster Filter)
CREATE INDEX idx_training_sessions_upcoming
  ON public.training_sessions(start_ts)
  WHERE is_cancelled = false;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.training_bookings ENABLE ROW LEVEL SECURITY;

-- Lesen: alle authentifizierten Nutzer
CREATE POLICY booking_select ON public.training_bookings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Buchen: spieler + trainer + höher (eigene Buchungen)
CREATE POLICY booking_insert ON public.training_bookings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'developer', 'vorstand', 'trainer', 'spieler')
    )
  );

-- Aktualisieren (Status-Wechsel): Trainer/Admin oder eigene Buchung
CREATE POLICY booking_update ON public.training_bookings
  FOR UPDATE USING (
    booked_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'developer', 'vorstand', 'trainer')
    )
  );
