/**
 * meetingDocumentService – Sitzungsdokumente verwalten.
 * Nutzt die existierende `meeting_documents`-Tabelle.
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { fromSupabaseError, errors } from '@/lib/error';
import type { ApiResult } from '@/types/api';

const STORAGE_BUCKET = 'board-files';

// ── Typen ─────────────────────────────────────────────────────

export interface MeetingDocumentUI {
  id: string;
  meetingId: string;
  title: string;
  fileUrl: string;
  uploadedBy: string;
  createdAt: string;
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
  };
}

// ── Service ───────────────────────────────────────────────────

export const meetingDocumentService = {
  async list(meetingId: string): Promise<ApiResult<MeetingDocumentUI[]>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('meeting_documents')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as DocRow[]).map(mapToUI);
    }, fromSupabaseError);
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
      const filePath = `meetings/${meetingId}/${uuid}-${safe}`;

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

  async remove(id: string): Promise<ApiResult<void>> {
    const { error } = await supabase
      .from('meeting_documents')
      .delete()
      .eq('id', id);
    if (error) return err(fromSupabaseError(error));
    return ok(undefined);
  },

  getPublicUrl(fileUrl: string): string {
    return fileUrl;
  },
};
