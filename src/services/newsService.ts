/**
 * newsService
 *
 * Verwaltet die `news`-Tabelle (Vereinsnews / interne Kommunikation).
 * Verwendet die tatsächliche DB-Struktur: title, content, is_published, published_at, author_id, image_url.
 */

import { supabase } from '@/integrations/supabase/client';

// ── Typen ─────────────────────────────────────────────────────

export interface NewsRow {
  id: string;
  title: string;
  content: string;
  is_published: boolean;
  published_at: string | null;
  author_id: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsCreateDTO {
  title: string;
  content: string;
  is_published?: boolean;
  author_id: string;
  image_url?: string | null;
}

export interface NewsUpdateDTO {
  title?: string;
  content?: string;
  is_published?: boolean;
  image_url?: string | null;
}

// ── Service ───────────────────────────────────────────────────

export const newsService = {
  async list(publishedOnly = false): Promise<NewsRow[]> {
    let q = supabase
      .from('news')
      .select('*')
      .order('created_at', { ascending: false });

    if (publishedOnly) q = q.eq('is_published', true);

    const { data, error } = await q;
    if (error) throw new Error(`[newsService] list: ${error.message}`);
    return (data ?? []) as NewsRow[];
  },

  async getById(id: string): Promise<NewsRow | null> {
    const { data, error } = await supabase
      .from('news')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`[newsService] getById: ${error.message}`);
    return (data as NewsRow) ?? null;
  },

  async create(payload: NewsCreateDTO): Promise<NewsRow> {
    const { data, error } = await supabase
      .from('news')
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(`[newsService] create: ${error.message}`);
    return data as NewsRow;
  },

  async update(id: string, payload: NewsUpdateDTO): Promise<NewsRow> {
    const { data, error } = await supabase
      .from('news')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`[newsService] update: ${error.message}`);
    return data as NewsRow;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('news')
      .delete()
      .eq('id', id);
    if (error) throw new Error(`[newsService] remove: ${error.message}`);
  },

  async publish(id: string): Promise<NewsRow> {
    return newsService.update(id, { is_published: true });
  },

  async unpublish(id: string): Promise<NewsRow> {
    return newsService.update(id, { is_published: false });
  },
};
