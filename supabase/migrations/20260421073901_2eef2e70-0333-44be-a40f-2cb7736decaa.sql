
CREATE TABLE public.board_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  position text NOT NULL,
  term_start date,
  term_end date,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "board_members_select" ON public.board_members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "board_members_insert" ON public.board_members
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'developer'));

CREATE POLICY "board_members_update" ON public.board_members
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'developer'));

CREATE POLICY "board_members_delete" ON public.board_members
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'developer'));

CREATE TRIGGER update_board_members_updated_at
  BEFORE UPDATE ON public.board_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
