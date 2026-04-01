-- Training domain hardening
-- Scope: 1:1 training_bookings only (keine Team-Trainingszeiten)

-- Ensure robust time-window semantics
ALTER TABLE public.training_bookings
  ADD CONSTRAINT chk_training_booking_time_window
  CHECK (end_time IS NULL OR end_time > start_time);

-- requester_id and partner_id must resolve to active members
CREATE OR REPLACE FUNCTION public.fn_validate_training_booking_members()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  requester_active BOOLEAN;
  partner_active BOOLEAN;
BEGIN
  IF NEW.requester_id = NEW.partner_id THEN
    RAISE EXCEPTION 'requester_id und partner_id müssen unterschiedlich sein';
  END IF;

  SELECT is_active INTO requester_active
  FROM public.members
  WHERE id = NEW.requester_id;

  IF requester_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'requester_id % ist kein aktives Mitglied', NEW.requester_id;
  END IF;

  SELECT is_active INTO partner_active
  FROM public.members
  WHERE id = NEW.partner_id;

  IF partner_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'partner_id % ist kein aktives Mitglied', NEW.partner_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_training_booking_members ON public.training_bookings;
CREATE TRIGGER trg_validate_training_booking_members
  BEFORE INSERT OR UPDATE OF requester_id, partner_id
  ON public.training_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_training_booking_members();

-- Prevent overlapping active bookings for any involved member (requester or partner)
CREATE OR REPLACE FUNCTION public.fn_prevent_training_booking_double_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  has_conflict BOOLEAN;
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.training_bookings b
    WHERE b.booking_date = NEW.booking_date
      AND b.status IN ('pending', 'confirmed')
      AND b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (b.requester_id IN (NEW.requester_id, NEW.partner_id)
        OR b.partner_id IN (NEW.requester_id, NEW.partner_id))
      AND (b.start_time < COALESCE(NEW.end_time, NEW.start_time)
        AND NEW.start_time < COALESCE(b.end_time, b.start_time))
  ) INTO has_conflict;

  IF has_conflict THEN
    RAISE EXCEPTION 'Doppelbuchung erkannt: Ein Mitglied ist im Zeitraum bereits gebucht';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_training_booking_double_booking ON public.training_bookings;
CREATE TRIGGER trg_prevent_training_booking_double_booking
  BEFORE INSERT OR UPDATE OF booking_date, start_time, end_time, requester_id, partner_id, status
  ON public.training_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_training_booking_double_booking();

-- Helpful indexes for conflict checks and dashboards
CREATE INDEX IF NOT EXISTS idx_training_bookings_active_by_date_time
  ON public.training_bookings(booking_date, start_time, end_time)
  WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_training_bookings_active_requester
  ON public.training_bookings(requester_id, booking_date)
  WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_training_bookings_active_partner
  ON public.training_bookings(partner_id, booking_date)
  WHERE status IN ('pending', 'confirmed');
