/**
 * newsService
 *
 * CRUD + Statusverwaltung für news_articles.
 * Tabelle: news_articles (slug, status, visibility, category, tags, pinned)
 *
 * Statusübergänge (DB-Trigger übernimmt published_at automatisch):
 *   draft ──► published ──► archived
 *        ◄──             ◄──
 *
 * Sichtbarkeit:
 *   public   → Vereinswebsite / nicht eingeloggte Besucher
 *   internal → nur authentifizierte Mitglieder
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { fromSupabaseError, errors } from '@/lib/error';
import { newsCreateSchema, newsUpdateSchema, slugify } from '@/schemas/news.schema';
import type { ApiResult } from '@/types/api';
import type {
  NewsArticle,
  NewsArticleUI,
  NewsCreateDTO,
  NewsFilter,
  NewsStatus,
  NewsUpdateDTO,
} from '@/types/domain/news';

// ── DB → UI ───────────────────────────────────────────────────

function mapToUI(row: NewsArticle): NewsArticleUI {
  return {
    id:          row.id,
    title:       row.title,
    slug:        row.slug,
    content:     row.content,
    excerpt:     row.excerpt,
    status:      row.status,
    visibility:  row.visibility,
    publishedAt: row.published_at,
    authorId:    row.author_id,
    category:    row.category,
    tags:        row.tags,
    pinned:      row.pinned,
    imageUrl:    row.image_url,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
    // Berechnete Flags
    isDraft:     row.status === 'draft',
    isPublished: row.status === 'published',
    isArchived:  row.status === 'archived',
    isInternal:  row.visibility === 'internal',
  };
}

// ── Service ───────────────────────────────────────────────────

export const newsService = {
  /**
   * Listet Artikel mit optionalen Filtern.
   * pinnedFirst=true (Standard): angeheftete Artikel stehen oben.
   */
  async list(filter: NewsFilter = {}): Promise<ApiResult<NewsArticleUI[]>> {
    return tryCatch(async () => {
      let q = supabase.from('news_articles').select('*');

      if (filter.status)     q = q.eq('status', filter.status);
      if (filter.visibility) q = q.eq('visibility', filter.visibility);
      if (filter.category)   q = q.eq('category', filter.category);
      if (filter.authorId)   q = q.eq('author_id', filter.authorId);
      if (filter.search) {
        // Volltextsuche in Titel und Teaser
        q = q.or(`title.ilike.%${filter.search}%,excerpt.ilike.%${filter.search}%`);
      }

      if (filter.pinnedFirst !== false) {
        q = q
          .order('pinned', { ascending: false })
          .order('published_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false });
      } else {
        q = q.order('created_at', { ascending: false });
      }

      const limit = filter.limit ?? 20;
      if (filter.offset != null) {
        q = q.range(filter.offset, filter.offset + limit - 1);
      } else {
        q = q.limit(limit);
      }

      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as NewsArticle[]).map(mapToUI);
    }, fromSupabaseError);
  },

  async getById(id: string): Promise<ApiResult<NewsArticleUI>> {
    const { data, error } = await supabase
      .from('news_articles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return err(fromSupabaseError(error));
    if (!data)  return err(errors.notFound('Artikel', id));
    return ok(mapToUI(data as NewsArticle));
  },

  async getBySlug(slug: string): Promise<ApiResult<NewsArticleUI>> {
    const { data, error } = await supabase
      .from('news_articles')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error) return err(fromSupabaseError(error));
    if (!data)  return err(errors.notFound('Artikel', slug));
    return ok(mapToUI(data as NewsArticle));
  },

  async create(payload: NewsCreateDTO): Promise<ApiResult<NewsArticleUI>> {
    return tryCatch(async () => {
      const parsed = newsCreateSchema.parse({
        ...payload,
        slug: payload.slug ?? slugify(payload.title),
      });
      const { data, error } = await supabase
        .from('news_articles')
        .insert(parsed)
        .select()
        .single();
      if (error) throw error;
      return mapToUI(data as NewsArticle);
    }, fromSupabaseError);
  },

  async update(id: string, payload: NewsUpdateDTO): Promise<ApiResult<NewsArticleUI>> {
    return tryCatch(async () => {
      const parsed = newsUpdateSchema.parse(payload);
      const { data, error } = await supabase
        .from('news_articles')
        .update(parsed)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return mapToUI(data as NewsArticle);
    }, fromSupabaseError);
  },

  async remove(id: string): Promise<ApiResult<void>> {
    const { error } = await supabase
      .from('news_articles')
      .delete()
      .eq('id', id);
    if (error) return err(fromSupabaseError(error));
    return ok(undefined);
  },

  // ── Statusübergänge ───────────────────────────────────────

  /**
   * Setzt den Status direkt.
   * published_at wird vom DB-Trigger manage_news_published_at automatisch verwaltet.
   */
  async setStatus(id: string, status: NewsStatus): Promise<ApiResult<NewsArticleUI>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('news_articles')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return mapToUI(data as NewsArticle);
    }, fromSupabaseError);
  },

  /** Entwurf → Veröffentlicht (setzt published_at via DB-Trigger) */
  publish:   (id: string) => newsService.setStatus(id, 'published'),

  /** Veröffentlicht → Entwurf (löscht published_at via DB-Trigger) */
  unpublish: (id: string) => newsService.setStatus(id, 'draft'),

  /** Archiviert – nicht mehr öffentlich sichtbar, bleibt erhalten */
  archive:   (id: string) => newsService.setStatus(id, 'archived'),

  // ── Convenience-Filter ─────────────────────────────────────

  /** Nur veröffentlichte, öffentliche Artikel (Vereinswebsite / Dashboard) */
  listPublic(filter: Omit<NewsFilter, 'status' | 'visibility'> = {}) {
    return newsService.list({ ...filter, status: 'published', visibility: 'public' });
  },

  /** Nur veröffentlichte, interne Artikel (eingeloggte Mitglieder) */
  listInternal(filter: Omit<NewsFilter, 'status' | 'visibility'> = {}) {
    return newsService.list({ ...filter, status: 'published', visibility: 'internal' });
  },

  /** Alle Entwürfe (Redaktionsansicht) */
  listDrafts(filter: Omit<NewsFilter, 'status'> = {}) {
    return newsService.list({ ...filter, status: 'draft' });
  },
};
