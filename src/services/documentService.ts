/**
 * documentService
 *
 * CRUD für die `documents`-Tabelle (allgemeine Vereinsdokumente).
 * Trennung:
 *   - documents          → frei kategorisierbare Vereinsdokumente
 *   - meeting_documents  → Protokolle / Anlagen zu Vorstandssitzungen
 *                          (werden über meetingService verwaltet)
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err } from '@/lib/api';
import { fromSupabaseError, errors } from '@/lib/error';
import type { ApiResult } from '@/types/api';

// ── Typen ─────────────────────────────────────────────────────

export interface DocumentRow {
  id:          string;
  title:       string;
  description: string | null;
  file_url:    string | null;
  category:    string;
  uploaded_by: string;
  created_at:  string;
  updated_at:  string;
}

export interface DocumentUI {
  id:          string;
  title:       string;
  description: string | null;
  fileUrl:     string | null;
  category:    string;
  uploadedBy:  string;
  createdAt:   string;
  updatedAt:   string;
}

export interface DocumentCreateDTO {
  title:       string;
  description?: string;
  file_url?:   string;
  category?:   string;
  uploaded_by: string;
}

export interface DocumentUpdateDTO {
  title?:       string;
  description?: string;
  file_url?:    string;
  category?:    string;
}

export interface DocumentFilter {
  category?: string;
  search?:   string;
}

// ── Mapping ───────────────────────────────────────────────────

function mapToUI(row: DocumentRow): DocumentUI {
  return {
    id:          row.id,
    title:       row.title,
    description: row.description,
    fileUrl:     row.file_url,
    category:    row.category,
    uploadedBy:  row.uploaded_by,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

// ── Service ───────────────────────────────────────────────────

export const documentService = {
  async list(filter: DocumentFilter = {}): Promise<ApiResult<DocumentUI[]>> {
    let q = supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter.category) q = q.eq('category', filter.category);
    if (filter.search)   q = q.ilike('title', `%${filter.search}%`);

    const { data, error } = await q;
    if (error) return err(fromSupabaseError(error));
    return ok(((data ?? []) as DocumentRow[]).map(mapToUI));
  },

  async getById(id: string): Promise<ApiResult<DocumentUI>> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return err(fromSupabaseError(error));
    if (!data)  return err(errors.notFound('Dokument', id));
    return ok(mapToUI(data as DocumentRow));
  },

  async create(payload: DocumentCreateDTO): Promise<ApiResult<DocumentUI>> {
    const { data, error } = await supabase
      .from('documents')
      .insert({ ...payload, category: payload.category ?? 'allgemein' })
      .select()
      .single();
    if (error) return err(fromSupabaseError(error));
    return ok(mapToUI(data as DocumentRow));
  },

  async update(id: string, payload: DocumentUpdateDTO): Promise<ApiResult<DocumentUI>> {
    const { data, error } = await supabase
      .from('documents')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) return err(fromSupabaseError(error));
    return ok(mapToUI(data as DocumentRow));
  },

  async remove(id: string): Promise<ApiResult<void>> {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);
    if (error) return err(fromSupabaseError(error));
    return ok(undefined);
  },

  /** Gibt alle genutzten Kategorienamen zurück (für Filter-Dropdown). */
  async listCategories(): Promise<ApiResult<string[]>> {
    const { data, error } = await supabase
      .from('documents')
      .select('category');
    if (error) return err(fromSupabaseError(error));
    const cats = [...new Set(((data ?? []) as { category: string }[]).map((r) => r.category))].sort();
    return ok(cats);
  },
};
