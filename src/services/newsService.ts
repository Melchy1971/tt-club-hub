/**
 * newsService
 *
 * Verwaltet news_articles (Vereinsnews / interne Kommunikation).
 *
 * Status-Logik:
 *   draft     → published  : published_at wird automatisch per DB-Trigger gesetzt
 *   published → archived   : published_at wird per DB-Trigger gelöscht
 *   archived  → published  : erlaubt (Wiederveröffentlichung)
 *   published → draft      : erlaubt (Entwurf zurückziehen)
 *
 * Sichtbarkeit:
 *   public   → sichtbar auf der Vereinswebsite (unauthentifiziert)
 *   internal → nur für eingeloggte Mitglieder
 *
 * Trennung öffentlich / intern wird über visibility gesteuert,
 * nicht über status – d.h. ein interner Artikel kann published sein
 * und trotzdem nur Mitgliedern angezeigt werden.
 */

import { supabase } from '@/integrations/supabase/client';
import { slugify, newsCreateSchema, newsUpdateSchema, newsFilterSchema } from '@/schemas/news.schema';
import type {
  NewsArticle,
  NewsArticleUI,
  NewsCreateDTO,
  NewsUpdateDTO,
  NewsFilter,
  NewsStatus,
} from '@/types';

// ── Mapping ───────────────────────────────────────────────────

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

    // Berechnete Felder
    isDraft:     row.status === 'draft',
    isPublished: row.status === 'published',
    isArchived:  row.status === 'archived',
    isInternal:  row.visibility === 'internal',
  };
}

// ── Fehlerbehandlung ──────────────────────────────────────────

function handleError(error: unknown, context: string): never {
  const message = (error as { message?: string })?.message ?? 'Unbekannter Fehler';
  throw new Error(`[newsService] ${context}: ${message}`);
}

// ── Service ───────────────────────────────────────────────────

export const newsService = {
  // ── Liste ────────────────────────────────────────────────────

  async list(filters: NewsFilter = {}): Promise<NewsArticleUI[]> {
    const f = newsFilterSchema.parse(filters);

    let q = supabase
      .from('news_articles')
      .select('*');

    if (f.status)     q = q.eq('status', f.status);
    if (f.visibility) q = q.eq('visibility', f.visibility);
    if (f.category)   q = q.eq('category', f.category);
    if (f.authorId)   q = q.eq('author_id', f.authorId);

    if (f.search) {
      const term = `%${f.search}%`;
      q = q.or(`title.ilike.${term},excerpt.ilike.${term}`);
    }

    // Sortierung: Angeheftete zuerst (optional), dann nach published_at/created_at
    if (f.pinnedFirst) {
      q = q.order('pinned', { ascending: false });
    }
    q = q
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at',   { ascending: false })
      .range(f.offset, f.offset + f.limit - 1);

    const { data, error } = await q;
    if (error) handleError(error, 'list');
    return (data as NewsArticle[] ?? []).map(mapToUI);
  },

  // ── Einzelabruf ───────────────────────────────────────────────

  async getById(id: string): Promise<NewsArticleUI | null> {
    const { data, error } = await supabase
      .from('news_articles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) handleError(error, 'getById');
    return data ? mapToUI(data as NewsArticle) : null;
  },

  async getBySlug(slug: string): Promise<NewsArticleUI | null> {
    const { data, error } = await supabase
      .from('news_articles')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error) handleError(error, 'getBySlug');
    return data ? mapToUI(data as NewsArticle) : null;
  },

  // ── CRUD ─────────────────────────────────────────────────────

  async create(payload: NewsCreateDTO): Promise<NewsArticleUI> {
    const parsed = newsCreateSchema.parse(payload);
    const { data, error } = await supabase
      .from('news_articles')
      .insert(parsed as any)
      .select()
      .single();
    if (error) handleError(error, 'create');
    return mapToUI(data as NewsArticle);
  },

  async update(id: string, payload: NewsUpdateDTO): Promise<NewsArticleUI> {
    const parsed = newsUpdateSchema.parse(payload);
    const { data, error } = await supabase
      .from('news_articles')
      .update(parsed as any)
      .eq('id', id)
      .select()
      .single();
    if (error) handleError(error, 'update');
    return mapToUI(data as NewsArticle);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('news_articles')
      .delete()
      .eq('id', id);
    if (error) handleError(error, 'remove');
  },

  // ── Veröffentlichungssteuerung ────────────────────────────────

  /**
   * Setzt den Status eines Artikels.
   * published_at wird dabei vollständig über den DB-Trigger gesteuert.
   *
   * Erlaubte Übergänge (nicht erzwungen – Redakteure entscheiden):
   *   draft → published | archived
   *   published → draft | archived
   *   archived → published | draft
   */
  async setStatus(id: string, status: NewsStatus): Promise<NewsArticleUI> {
    const { data, error } = await supabase
      .from('news_articles')
      .update({ status } as any)
      .eq('id', id)
      .select()
      .single();
    if (error) handleError(error, 'setStatus');
    return mapToUI(data as NewsArticle);
  },

  /** Artikel veröffentlichen (Kurzform). */
  async publish(id: string): Promise<NewsArticleUI> {
    return newsService.setStatus(id, 'published');
  },

  /** Artikel in Entwurf zurückziehen (depublizieren). */
  async unpublish(id: string): Promise<NewsArticleUI> {
    return newsService.setStatus(id, 'draft');
  },

  /** Artikel archivieren. */
  async archive(id: string): Promise<NewsArticleUI> {
    return newsService.setStatus(id, 'archived');
  },

  // ── Anheften ─────────────────────────────────────────────────

  async setPin(id: string, pinned: boolean): Promise<NewsArticleUI> {
    const { data, error } = await supabase
      .from('news_articles')
      .update({ pinned } as any)
      .eq('id', id)
      .select()
      .single();
    if (error) handleError(error, 'setPin');
    return mapToUI(data as NewsArticle);
  },

  // ── Slug-Prüfung ─────────────────────────────────────────────

  /**
   * Prüft ob ein Slug bereits existiert (exkludiert optional einen bestehenden Artikel).
   * Nützlich für die UI-Validierung vor dem Speichern.
   */
  async isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
    let q = supabase
      .from('news_articles')
      .select('id', { count: 'exact', head: true })
      .eq('slug', slug);
    if (excludeId) q = q.neq('id', excludeId);
    const { count, error } = await q;
    if (error) handleError(error, 'isSlugTaken');
    return (count ?? 0) > 0;
  },

  /**
   * Generiert einen eindeutigen Slug aus einem Titel.
   * Bei Kollision wird ein numerisches Suffix angehängt (-2, -3 …).
   */
  async generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    let attempt = 2;

    while (await newsService.isSlugTaken(candidate, excludeId)) {
      candidate = `${base}-${attempt++}`;
      if (attempt > 50) throw new Error(`Kein eindeutiger Slug für "${title}" generierbar`);
    }
    return candidate;
  },

  // ── Öffentliches Feed (keine Auth nötig) ─────────────────────

  /**
   * Gibt veröffentlichte, öffentliche Artikel zurück – kein Auth-Token erforderlich.
   * Ideal für statische Websites oder öffentliche Newsfeeds.
   */
  async listPublic(options: { limit?: number; category?: string } = {}): Promise<NewsArticleUI[]> {
    return newsService.list({
      status:     'published',
      visibility: 'public',
      limit:      options.limit ?? 10,
      category:   options.category,
      pinnedFirst: true,
    });
  },

  /**
   * Gibt veröffentlichte interne Artikel zurück – nur für authentifizierte Mitglieder.
   */
  async listInternal(options: { limit?: number; category?: string } = {}): Promise<NewsArticleUI[]> {
    return newsService.list({
      status:     'published',
      visibility: 'internal',
      limit:      options.limit ?? 20,
      category:   options.category,
      pinnedFirst: true,
    });
  },
};
