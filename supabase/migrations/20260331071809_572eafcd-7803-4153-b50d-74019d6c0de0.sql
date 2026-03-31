
-- News-Tabelle für Vereinsnachrichten
CREATE TABLE public.news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  author_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "news_select" ON public.news FOR SELECT TO authenticated USING (true);
CREATE POLICY "news_insert" ON public.news FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "news_update" ON public.news FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "news_delete" ON public.news FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));

CREATE TRIGGER update_news_updated_at BEFORE UPDATE ON public.news
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Dokumente-Tabelle
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  category TEXT DEFAULT 'allgemein',
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "documents_insert" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "documents_update" ON public.documents FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "documents_delete" ON public.documents FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Kommunikationslisten
CREATE TABLE public.communication_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  list_type TEXT NOT NULL DEFAULT 'email',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.communication_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comm_lists_select" ON public.communication_lists FOR SELECT TO authenticated USING (true);
CREATE POLICY "comm_lists_insert" ON public.communication_lists FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "comm_lists_update" ON public.communication_lists FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "comm_lists_delete" ON public.communication_lists FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));

CREATE TRIGGER update_comm_lists_updated_at BEFORE UPDATE ON public.communication_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Listenmitglieder
CREATE TABLE public.communication_list_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.communication_lists(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(list_id, member_id)
);

ALTER TABLE public.communication_list_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comm_list_members_select" ON public.communication_list_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "comm_list_members_insert" ON public.communication_list_members FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
CREATE POLICY "comm_list_members_delete" ON public.communication_list_members FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand'));
