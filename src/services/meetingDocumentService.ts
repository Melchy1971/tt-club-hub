/**
 * meetingDocumentService – Sitzungsdokumente verwalten.
 * Nutzt die existierende `meeting_documents`-Tabelle.
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { fromSupabaseError, errors } from '@/lib/error';
import { boardAccessPolicy } from '@/services/boardAccessPolicy';
import type { ApiResult } from '@/types/api';
import type { BoardActorRole, BoardDocumentFilter } from '@/types/domain/board';

const STORAGE_BUCKET = 'board-files';
const INTERNAL_PATH_PREFIX = 'internal/meetings';

// ── Typen ─────────────────────────────────────────────────────

export interface MeetingDocumentUI {
  id: string;
  meetingId: string;
  title: string;
  fileUrl: string;
  uploadedBy: string;
  createdAt: string;
  visibility: 'internal';
}

export interface MeetingDocumentUploadDTO {
  title: string;
  uploaded_by: string;
}

// ── Mapping ───────────────────────────────────────────────────

type DocRow = {
  id: string;
  meeting_id: string;
  title: string;
  file_url: string;
  uploaded_by: string;
  created_at: string;
};

function mapToUI(row: DocRow): MeetingDocumentUI {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    title: row.title,
    fileUrl: row.file_url,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    visibility: 'internal',
  };
}

function guard(role: BoardActorRole, action: 'read' | 'write' | 'delete'): ApiResult<void> {
  return boardAccessPolicy.authorize(role, { channel: 'documents', visibility: 'internal' }, action);
}

// ── Service ───────────────────────────────────────────────────

export const meetingDocumentService = {
  async list(meetingId: string, filter: BoardDocumentFilter = {}): Promise<ApiResult<MeetingDocumentUI[]>> {
    if (filter.visibility && filter.visibility !== 'internal') {
      return err(errors.validation('Sitzungsdokumente sind ausschließlich intern.'));
    }

    return tryCatch(async () => {
      let query = supabase
        .from('meeting_documents')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true });

      if (filter.search) query = query.ilike('title', `%${filter.search}%`);

      const limit = filter.limit ?? 200;
      if (filter.offset != null) {
        query = query.range(filter.offset, filter.offset + limit - 1);
      } else {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as DocRow[]).map(mapToUI);
    }, fromSupabaseError);
  },

  async listForActor(role: BoardActorRole, meetingId: string, filter: BoardDocumentFilter = {}): Promise<ApiResult<MeetingDocumentUI[]>> {
    const auth = guard(role, 'read');
    if (!auth.ok) return auth;
    return meetingDocumentService.list(meetingId, { ...filter, visibility: 'internal' });
  },

  async getById(id: string): Promise<ApiResult<MeetingDocumentUI>> {
    const { data, error } = await supabase
      .from('meeting_documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return err(fromSupabaseError(error));
    if (!data) return err(errors.notFound('Sitzungsdokument', id));
    return ok(mapToUI(data as DocRow));
  },

  async upload(
    meetingId: string,
    file: File,
    payload: MeetingDocumentUploadDTO,
  ): Promise<ApiResult<MeetingDocumentUI>> {
    return tryCatch(async () => {
      const uuid = crypto.randomUUID();
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${INTERNAL_PATH_PREFIX}/${meetingId}/${uuid}-${safe}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

      const { data, error: dbError } = await supabase
        .from('meeting_documents')
        .insert({
          meeting_id: meetingId,
          title: payload.title,
          file_url: urlData.publicUrl,
          uploaded_by: payload.uploaded_by,
        })
        .select()
        .single();

      if (dbError) {
        await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);
        throw dbError;
      }

      return mapToUI(data as DocRow);
    }, fromSupabaseError);
  },

  async uploadForActor(
    role: BoardActorRole,
    meetingId: string,
    file: File,
    payload: MeetingDocumentUploadDTO,
  ): Promise<ApiResult<MeetingDocumentUI>> {
    const auth = guard(role, 'write');
    if (!auth.ok) return auth;
    return meetingDocumentService.upload(meetingId, file, payload);
  },

  async remove(id: string): Promise<ApiResult<void>> {
    const { error } = await supabase
      .from('meeting_documents')
      .delete()
      .eq('id', id);
    if (error) return err(fromSupabaseError(error));
    return ok(undefined);
  },

  async removeForActor(role: BoardActorRole, id: string): Promise<ApiResult<void>> {
    const auth = guard(role, 'delete');
    if (!auth.ok) return auth;
    return meetingDocumentService.remove(id);
  },

  getPublicUrl(fileUrl: string): string {
    return fileUrl;
  },
};
