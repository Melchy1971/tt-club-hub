
-- Training bookings status enum
CREATE TYPE public.training_booking_status AS ENUM ('pending', 'confirmed', 'cancelled');

-- Training bookings table
CREATE TABLE public.training_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  start_time TIME WITHOUT TIME ZONE NOT NULL,
  end_time TIME WITHOUT TIME ZONE,
  location TEXT,
  status public.training_booking_status NOT NULL DEFAULT 'pending',
  note TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.training_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_bookings_select" ON public.training_bookings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "training_bookings_insert" ON public.training_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'vorstand'::app_role) OR
    has_role(auth.uid(), 'trainer'::app_role) OR
    has_role(auth.uid(), 'spieler'::app_role)
  );

CREATE POLICY "training_bookings_update" ON public.training_bookings
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'vorstand'::app_role) OR
    has_role(auth.uid(), 'trainer'::app_role) OR
    created_by = auth.uid()
  );

CREATE POLICY "training_bookings_delete" ON public.training_bookings
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'vorstand'::app_role) OR
    created_by = auth.uid()
  );

-- Updated_at trigger
CREATE TRIGGER update_training_bookings_updated_at
  BEFORE UPDATE ON public.training_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
