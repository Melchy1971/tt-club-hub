
-- Sitzungen-Tabelle
CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  meeting_time TIME,
  location TEXT,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meetings_select" ON public.meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "meetings_insert" ON public.meetings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "meetings_update" ON public.meetings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "meetings_delete" ON public.meetings FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));

CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sitzungsdokumente
CREATE TABLE public.meeting_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meeting_docs_select" ON public.meeting_documents FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "meeting_docs_insert" ON public.meeting_documents FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "meeting_docs_delete" ON public.meeting_documents FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));

-- News: image_url Spalte hinzufügen
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Storage Bucket für Vorstand-Dateien
INSERT INTO storage.buckets (id, name, public) VALUES ('board-files', 'board-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "board_files_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'board-files');
CREATE POLICY "board_files_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'board-files' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand')));
CREATE POLICY "board_files_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'board-files' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand')));
