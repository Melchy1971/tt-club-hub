/**
 * meetingDocumentService
 *
 * Verwaltet Sitzungsdokumente (Protokolle, Anlagen) zu Vorstandssitzungen.
 *
 * DB-Tabelle: meeting_documents
 *   id          uuid PK
 *   meeting_id  uuid → board_meetings.id (ON DELETE CASCADE)
 *   title       text
 *   file_path   text   ← Storage-Pfad (intern: internal/{meetingId}/{uuid}-{name})
 *                                       (extern:  public/{meetingId}/{uuid}-{name})
 *   file_type   text | null  (z. B. 'pdf', 'docx')
 *   file_size   integer | null  (Bytes)
 *   is_internal boolean DEFAULT true
 *   uploaded_by uuid → members.id | null
 *   created_at  timestamptz
 *
 * Storage-Bucket: board-documents
 *   Ordnerstruktur:
 *     internal/{meetingId}/{uuid}-{filename}  → private (signed URL erforderlich)
 *     public/{meetingId}/{uuid}-{filename}    → public (öffentliche URL)
 *
 * Sichtbarkeitsregeln:
 *   is_internal = true  → nur board:read (Vorstand, Admin, Developer)
 *   is_internal = false → alle angemeldeten Nutzer, ggf. auch unauthenticated
 *
 * Zugriffsregeln:
 *   SELECT (intern)  → board:read
 *   SELECT (public)  → kein Login nötig
 *   INSERT/UPDATE    → board:write
 *   DELETE           → board:delete (löscht auch Storage-Datei)
 *
 * RLS-Empfehlung (meeting_documents):
 *   SELECT: is_internal = false
 *        OR EXISTS (... role IN ('vorstand','admin','developer'))
 *   INSERT/UPDATE: role IN ('vorstand','admin','developer')
 *   DELETE: role IN ('admin','developer')
 *
 * RLS-Empfehlung (Storage: board-documents):
 *   Bucket-Policy: authenticated only
 *   internal/*: SELECT nur für vorstand/admin/developer
 *   public/*:   SELECT für alle authenticated
 *
 * WARNUNG – Datenleck-Risiko:
 *   Niemals list() ohne includeInternal=false aufrufen, wenn der Caller
 *   keine board:read-Berechtigung hat. Besser: listPublic() verwenden.
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { fromSupabaseError, errors } from '@/lib/error';
import type { ApiResult } from '@/types/api';

// ── Konstanten ────────────────────────────────────────────────

const STORAGE_BUCKET = 'board-documents';

// ── Typen ─────────────────────────────────────────────────────

export interface MeetingDocumentRow {
  id:          string;
  meeting_id:  string;
  title:       string;
  file_path:   string;
  file_type:   string | null;
  file_size:   number | null;
  is_internal: boolean;
  uploaded_by: string | null;
  created_at:  string;
}

export interface MeetingDocumentUI {
  id:         string;
  meetingId:  string;
  title:      string;
  filePath:   string;
  fileType:   string | null;
  fileSize:   number | null;
  isInternal: boolean;
  uploadedBy: string | null;
  createdAt:  string;
}

export interface MeetingDocumentUploadDTO {
  title:       string;
  is_internal: boolean;
  uploaded_by?: string | null;
}

export interface MeetingDocumentUpdateDTO {
  title?:       string;
  is_internal?: boolean;
}

// ── Hilfsfunktionen ───────────────────────────────────────────

function mapToUI(row: MeetingDocumentRow): MeetingDocumentUI {
  return {
    id:         row.id,
    meetingId:  row.meeting_id,
    title:      row.title,
    filePath:   row.file_path,
    fileType:   row.file_type,
    fileSize:   row.file_size,
    isInternal: row.is_internal,
    uploadedBy: row.uploaded_by,
    createdAt:  row.created_at,
  };
}

/** Erstellt den Storage-Pfad: internal|public/{meetingId}/{uuid}-{filename} */
function buildStoragePath(meetingId: string, fileName: string, isInternal: boolean): string {
  const folder = isInternal ? 'internal' : 'public';
  const uuid   = crypto.randomUUID();
  const safe   = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${folder}/${meetingId}/${uuid}-${safe}`;
}

// ── Service ───────────────────────────────────────────────────

export const meetingDocumentService = {
  /**
   * Dokumente einer Sitzung laden.
   *
   * @param includeInternal
   *   true  → alle Dokumente (nur für board:read verwenden)
   *   false → nur öffentliche Dokumente (sicher für alle Rollen)
   */
  async list(
    meetingId: string,
    { includeInternal }: { includeInternal: boolean },
  ): Promise<ApiResult<MeetingDocumentUI[]>> {
    return tryCatch(async () => {
      let q = supabase
        .from('meeting_documents')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true });

      if (!includeInternal) q = q.eq('is_internal', false);

      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as MeetingDocumentRow[]).map(mapToUI);
    }, fromSupabaseError);
  },

  /**
   * Shortcut: nur öffentliche Dokumente.
   * Sicher für alle Rollen inkl. unauthenticated.
   */
  listPublic(meetingId: string): Promise<ApiResult<MeetingDocumentUI[]>> {
    return meetingDocumentService.list(meetingId, { includeInternal: false });
  },

  async getById(id: string): Promise<ApiResult<MeetingDocumentUI>> {
    const { data, error } = await supabase
      .from('meeting_documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return err(fromSupabaseError(error));
    if (!data)  return err(errors.notFound('Sitzungsdokument', id));
    return ok(mapToUI(data as MeetingDocumentRow));
  },

  /**
   * Lädt eine Datei hoch und erstellt den DB-Eintrag.
   *
   * Ablauf:
   *   1. Datei → Supabase Storage (board-documents)
   *   2. DB-Eintrag mit file_path
   *
   * Wichtig: is_internal bestimmt den Storage-Ordner (internal/ vs. public/).
   * Storage-RLS muss passend konfiguriert sein (siehe Kopfkommentar).
   */
  async upload(
    meetingId: string,
    file: File,
    payload: MeetingDocumentUploadDTO,
  ): Promise<ApiResult<MeetingDocumentUI>> {
    return tryCatch(async () => {
      const filePath = buildStoragePath(meetingId, file.name, payload.is_internal);

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      const insert = {
        meeting_id:  meetingId,
        title:       payload.title,
        file_path:   filePath,
        file_type:   file.type || null,
        file_size:   file.size || null,
        is_internal: payload.is_internal,
        uploaded_by: payload.uploaded_by ?? null,
      };

      const { data, error: dbError } = await supabase
        .from('meeting_documents')
        .insert(insert)
        .select()
        .single();

      if (dbError) {
        // Cleanup: Storage-Datei löschen, wenn DB-Insert fehlschlägt
        await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);
        throw dbError;
      }

      return mapToUI(data as MeetingDocumentRow);
    }, fromSupabaseError);
  },

  async update(id: string, payload: MeetingDocumentUpdateDTO): Promise<ApiResult<MeetingDocumentUI>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('meeting_documents')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return mapToUI(data as MeetingDocumentRow);
    }, fromSupabaseError);
  },

  /**
   * Löscht DB-Eintrag + Storage-Datei.
   * Caller braucht board:delete.
   */
  async remove(id: string): Promise<ApiResult<void>> {
    // Erst file_path holen, dann löschen
    const docResult = await meetingDocumentService.getById(id);
    if (!docResult.success) return docResult;

    const { error: dbError } = await supabase
      .from('meeting_documents')
      .delete()
      .eq('id', id);
    if (dbError) return err(fromSupabaseError(dbError));

    // Storage-Datei entfernen (nicht-fatal: DB-Eintrag ist bereits weg)
    await supabase.storage.from(STORAGE_BUCKET).remove([docResult.data.filePath]);

    return ok(undefined);
  },

  /**
   * Gibt eine signierte temporäre Download-URL zurück.
   * Für interne Dokumente zwingend verwenden (kein public URL möglich).
   *
   * @param expiresIn  Gültigkeit in Sekunden (Standard: 3600 = 1 h)
   */
  async getSignedUrl(id: string, expiresIn = 3_600): Promise<ApiResult<string>> {
    const docResult = await meetingDocumentService.getById(id);
    if (!docResult.success) return docResult;

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(docResult.data.filePath, expiresIn);

    if (error) return err(fromSupabaseError(error));
    return ok(data.signedUrl);
  },

  /**
   * Gibt die öffentliche URL zurück.
   * NUR für Dokumente mit is_internal = false verwenden.
   * Für interne Dokumente → getSignedUrl() verwenden.
   */
  getPublicUrl(filePath: string): string {
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
    return data.publicUrl;
  },
};
