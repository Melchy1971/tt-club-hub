/**
 * newsService – CRUD für die Tabelle `news`
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { fromSupabaseError, errors } from '@/lib/error';
import { newsCreateSchema, newsUpdateSchema } from '@/schemas/news.schema';
import type { ApiResult } from '@/types/api';
import type { NewsRow, NewsCreateDTO, NewsUpdateDTO, NewsFilter } from '@/types/domain/news';

export const newsService = {
  async list(filter: NewsFilter = {}): Promise<ApiResult<NewsRow[]>> {
    return tryCatch(async () => {
      let q = supabase.from('news').select('*');

      if (filter.is_published != null) q = q.eq('is_published', filter.is_published);
      if (filter.search) {
        q = q.or(`title.ilike.%${filter.search}%,content.ilike.%${filter.search}%`);
      }

      q = q.order('created_at', { ascending: false });

      const limit = filter.limit ?? 20;
      if (filter.offset != null) {
        q = q.range(filter.offset, filter.offset + limit - 1);
      } else {
        q = q.limit(limit);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as NewsRow[];
    }, fromSupabaseError);
  },

  async getById(id: string): Promise<ApiResult<NewsRow>> {
    const { data, error } = await supabase
      .from('news')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return err(fromSupabaseError(error));
    if (!data) return err(errors.notFound('Artikel', id));
    return ok(data as NewsRow);
  },

  async create(payload: NewsCreateDTO): Promise<ApiResult<NewsRow>> {
    return tryCatch(async () => {
      const parsed = newsCreateSchema.parse(payload);
      const { data, error } = await supabase
        .from('news')
        .insert({
          ...parsed,
          published_at: parsed.is_published ? new Date().toISOString() : null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as NewsRow;
    }, fromSupabaseError);
  },

  async update(id: string, payload: NewsUpdateDTO): Promise<ApiResult<NewsRow>> {
    return tryCatch(async () => {
      const parsed = newsUpdateSchema.parse(payload);
      const updateData: Record<string, unknown> = { ...parsed };
      if (parsed.is_published != null) {
        updateData.published_at = parsed.is_published ? new Date().toISOString() : null;
      }
      const { data, error } = await supabase
        .from('news')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as NewsRow;
    }, fromSupabaseError);
  },

  async remove(id: string): Promise<ApiResult<void>> {
    const { error } = await supabase.from('news').delete().eq('id', id);
    if (error) return err(fromSupabaseError(error));
    return ok(undefined);
  },

  async publish(id: string): Promise<ApiResult<NewsRow>> {
    return newsService.update(id, { is_published: true });
  },

  async unpublish(id: string): Promise<ApiResult<NewsRow>> {
    return newsService.update(id, { is_published: false });
  },

  listPublished(filter: Omit<NewsFilter, 'is_published'> = {}) {
    return newsService.list({ ...filter, is_published: true });
  },
};
