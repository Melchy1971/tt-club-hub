// ============================================================
// News-Domain-Typen
//
// Rohdaten-Typen (DB-Zeilen) sind manuell definiert, bis
// `supabase gen types typescript` die Enums news_status /
// news_visibility kennt. Danach durch Tables<'news_articles'>
// ersetzen und diese Datei vereinfachen.
// ============================================================

// ── Rohdaten (1:1 DB-Schema) ─────────────────────────────────

export type NewsStatus = 'draft' | 'published' | 'archived';
export type NewsVisibility = 'public' | 'internal';

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  status: NewsStatus;
  visibility: NewsVisibility;
  published_at: string | null;
  author_id: string | null;
  category: string | null;
  tags: string[];
  pinned: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

// ── UI-Projektion (camelCase, angereichert) ───────────────────

export interface NewsArticleUI {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  status: NewsStatus;
  visibility: NewsVisibility;
  publishedAt: string | null;
  authorId: string | null;
  category: string | null;
  tags: string[];
  pinned: boolean;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;

  // Berechnete Felder
  isDraft: boolean;
  isPublished: boolean;
  isArchived: boolean;
  isInternal: boolean;
}

// ── DTOs ─────────────────────────────────────────────────────

export interface NewsCreateDTO {
  title: string;
  slug?: string;           // optional – wird aus title generiert wenn leer
  content?: string;
  excerpt?: string;
  status?: NewsStatus;
  visibility?: NewsVisibility;
  author_id?: string;
  category?: string;
  tags?: string[];
  pinned?: boolean;
  image_url?: string;
}

export interface NewsUpdateDTO {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  visibility?: NewsVisibility;
  author_id?: string;
  category?: string;
  tags?: string[];
  pinned?: boolean;
  image_url?: string;
}

// ── Filter / Query-Optionen ───────────────────────────────────

export interface NewsFilter {
  status?: NewsStatus;
  visibility?: NewsVisibility;
  category?: string;
  authorId?: string;
  search?: string;          // Volltextsuche in title + excerpt
  pinnedFirst?: boolean;
  limit?: number;
  offset?: number;
}
