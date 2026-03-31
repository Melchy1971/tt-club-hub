-- ============================================================
-- News-Modul: news_articles
-- Status:     draft | published | archived
-- Visibility: public (Vereinswebsite) | internal (nur Mitglieder)
-- ============================================================

-- Enums
CREATE TYPE news_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE news_visibility AS ENUM ('public', 'internal');

-- Tabelle
CREATE TABLE news_articles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  slug         TEXT        NOT NULL UNIQUE,
  content      TEXT,                            -- Markdown / Rich-Text
  excerpt      TEXT,                            -- Kurzzusammenfassung (für Listen)
  status       news_status NOT NULL DEFAULT 'draft',
  visibility   news_visibility NOT NULL DEFAULT 'public',
  published_at TIMESTAMPTZ,                     -- gesetzt wenn status → published
  author_id    UUID        REFERENCES members(id) ON DELETE SET NULL,
  category     TEXT,                            -- frei wählbar (Vereinsnews, Spielbericht …)
  tags         TEXT[]      NOT NULL DEFAULT '{}',
  pinned       BOOLEAN     NOT NULL DEFAULT FALSE,
  image_url    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indizes
CREATE INDEX news_articles_status_idx       ON news_articles (status);
CREATE INDEX news_articles_visibility_idx   ON news_articles (visibility);
CREATE INDEX news_articles_published_at_idx ON news_articles (published_at DESC);
CREATE INDEX news_articles_author_id_idx    ON news_articles (author_id);
CREATE INDEX news_articles_pinned_idx       ON news_articles (pinned) WHERE pinned = TRUE;

-- updated_at Trigger
CREATE OR REPLACE FUNCTION set_news_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_news_articles_updated_at
  BEFORE UPDATE ON news_articles
  FOR EACH ROW EXECUTE FUNCTION set_news_updated_at();

-- published_at automatisch setzen / löschen wenn Status wechselt
CREATE OR REPLACE FUNCTION manage_news_published_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'published' AND OLD.status <> 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at = NOW();
  END IF;
  IF NEW.status <> 'published' AND OLD.status = 'published' THEN
    NEW.published_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_news_articles_published_at
  BEFORE UPDATE ON news_articles
  FOR EACH ROW EXECUTE FUNCTION manage_news_published_at();

-- RLS
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

-- Öffentlich publizierte Artikel: alle lesen
CREATE POLICY "news_public_read"
  ON news_articles FOR SELECT
  USING (status = 'published' AND visibility = 'public');

-- Interne Artikel: authentifizierte Nutzer lesen
CREATE POLICY "news_internal_read"
  ON news_articles FOR SELECT
  TO authenticated
  USING (status = 'published' AND visibility = 'internal');

-- Entwürfe + archivierte: nur eigener Autor oder Admin
CREATE POLICY "news_author_read_own"
  ON news_articles FOR SELECT
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'board')
    )
  );

-- Schreiben: nur Admin / Vorstand
CREATE POLICY "news_write"
  ON news_articles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'board')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'board')
    )
  );
