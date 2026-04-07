-- Board-Domain vervollständigen:
-- - board_members als dedizierte Vorstandstabelle
-- - meetings um topic + status erweitern (board_meetings-Modell)
-- - interne Inhalte strikt auf admin/vorstand begrenzen

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'board_meeting_status'
  ) THEN
    CREATE TYPE public.board_meeting_status AS ENUM ('planned', 'confirmed', 'completed', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.board_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  position TEXT NOT NULL,
  term_start DATE,
  term_end DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT board_members_term_chk CHECK (term_end IS NULL OR term_start IS NULL OR term_end >= term_start)
);

CREATE UNIQUE INDEX IF NOT EXISTS board_members_user_position_active_uniq
  ON public.board_members (user_id, position)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS board_members_is_active_idx ON public.board_members (is_active);
CREATE INDEX IF NOT EXISTS board_members_term_end_idx ON public.board_members (term_end);

ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "board_members_select" ON public.board_members;
CREATE POLICY "board_members_select"
  ON public.board_members FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));

DROP POLICY IF EXISTS "board_members_insert" ON public.board_members;
CREATE POLICY "board_members_insert"
  ON public.board_members FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));

DROP POLICY IF EXISTS "board_members_update" ON public.board_members;
CREATE POLICY "board_members_update"
  ON public.board_members FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));

DROP POLICY IF EXISTS "board_members_delete" ON public.board_members;
CREATE POLICY "board_members_delete"
  ON public.board_members FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_board_members_updated_at ON public.board_members;
CREATE TRIGGER update_board_members_updated_at
  BEFORE UPDATE ON public.board_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS status public.board_meeting_status NOT NULL DEFAULT 'planned';

UPDATE public.meetings
SET topic = COALESCE(topic, title)
WHERE topic IS NULL;

ALTER TABLE public.meetings
  ALTER COLUMN topic SET NOT NULL;

DROP POLICY IF EXISTS "meetings_select" ON public.meetings;
CREATE POLICY "meetings_select"
  ON public.meetings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));

DROP POLICY IF EXISTS "meeting_docs_select" ON public.meeting_documents;
CREATE POLICY "meeting_docs_select"
  ON public.meeting_documents FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
