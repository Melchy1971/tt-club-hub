-- Dokumentmodell-Refactor: generischer Kontext + Upload-Metadaten
-- Zielkontexte: communication, board_meeting, board_general, public

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS owner_context TEXT,
  ADD COLUMN IF NOT EXISTS owner_id UUID,
  ADD COLUMN IF NOT EXISTS visibility TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS uploader_id UUID;

UPDATE public.documents
SET
  owner_context = COALESCE(owner_context, 'communication'),
  visibility = COALESCE(
    visibility,
    CASE
      WHEN category LIKE 'internal:%' THEN 'internal'
      ELSE 'public'
    END
  ),
  uploader_id = COALESCE(uploader_id, uploaded_by),
  file_name = COALESCE(file_name, split_part(COALESCE(file_url, ''), '/', array_length(string_to_array(COALESCE(file_url, ''), '/'), 1))),
  storage_bucket = COALESCE(storage_bucket, 'board-files')
WHERE
  owner_context IS NULL
  OR visibility IS NULL
  OR uploader_id IS NULL
  OR storage_bucket IS NULL
  OR file_name IS NULL;

ALTER TABLE public.documents
  ALTER COLUMN owner_context SET DEFAULT 'communication',
  ALTER COLUMN owner_context SET NOT NULL,
  ALTER COLUMN visibility SET DEFAULT 'internal',
  ALTER COLUMN visibility SET NOT NULL,
  ALTER COLUMN uploader_id SET NOT NULL,
  ALTER COLUMN storage_bucket SET DEFAULT 'board-files',
  ALTER COLUMN storage_bucket SET NOT NULL;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_owner_context_chk
    CHECK (owner_context IN ('communication', 'board_meeting', 'board_general', 'public')),
  ADD CONSTRAINT documents_visibility_chk
    CHECK (visibility IN ('public', 'internal')),
  ADD CONSTRAINT documents_file_size_non_negative_chk
    CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  ADD CONSTRAINT documents_board_meeting_owner_required_chk
    CHECK (owner_context <> 'board_meeting' OR owner_id IS NOT NULL),
  ADD CONSTRAINT documents_storage_path_required_chk
    CHECK (storage_path IS NOT NULL OR file_url IS NOT NULL);

CREATE INDEX IF NOT EXISTS documents_owner_context_visibility_idx
  ON public.documents (owner_context, visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS documents_owner_id_idx
  ON public.documents (owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS documents_storage_unique_idx
  ON public.documents (storage_bucket, storage_path)
  WHERE storage_path IS NOT NULL;

-- Legacy meeting_documents in das generische documents-Modell überführen
INSERT INTO public.documents (
  title,
  description,
  file_url,
  category,
  uploaded_by,
  uploader_id,
  owner_context,
  owner_id,
  visibility,
  file_name,
  storage_bucket,
  created_at,
  updated_at
)
SELECT
  md.title,
  NULL,
  md.file_url,
  'meeting',
  md.uploaded_by,
  md.uploaded_by,
  'board_meeting',
  md.meeting_id,
  'internal',
  split_part(md.file_url, '/', array_length(string_to_array(md.file_url, '/'), 1)),
  'board-files',
  md.created_at,
  md.created_at
FROM public.meeting_documents md
LEFT JOIN public.documents d
  ON d.owner_context = 'board_meeting'
 AND d.owner_id = md.meeting_id
 AND d.file_url = md.file_url
WHERE d.id IS NULL;

CREATE OR REPLACE FUNCTION public.can_access_document_context(
  _owner_context TEXT,
  _visibility TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _owner_context = 'public' OR _visibility = 'public' THEN
    RETURN TRUE;
  END IF;

  IF _owner_context = 'communication' THEN
    RETURN has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'trainer');
  END IF;

  IF _owner_context = 'board_general' OR _owner_context = 'board_meeting' THEN
    RETURN has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vorstand') OR has_role(auth.uid(), 'developer');
  END IF;

  RETURN FALSE;
END;
$$;

DROP POLICY IF EXISTS "documents_select" ON public.documents;
DROP POLICY IF EXISTS "documents_insert" ON public.documents;
DROP POLICY IF EXISTS "documents_update" ON public.documents;
DROP POLICY IF EXISTS "documents_delete" ON public.documents;

CREATE POLICY "documents_select_contextual" ON public.documents
FOR SELECT TO authenticated
USING (public.can_access_document_context(owner_context, visibility));

CREATE POLICY "documents_insert_contextual" ON public.documents
FOR INSERT TO authenticated
WITH CHECK (
  public.can_access_document_context(owner_context, visibility)
  AND (
    owner_context = 'public'
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'vorstand')
  )
);

CREATE POLICY "documents_update_contextual" ON public.documents
FOR UPDATE TO authenticated
USING (public.can_access_document_context(owner_context, visibility))
WITH CHECK (
  public.can_access_document_context(owner_context, visibility)
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'vorstand')
    OR has_role(auth.uid(), 'developer')
  )
);

CREATE POLICY "documents_delete_contextual" ON public.documents
FOR DELETE TO authenticated
USING (
  public.can_access_document_context(owner_context, visibility)
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'developer'))
);
