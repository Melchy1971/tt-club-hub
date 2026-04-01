/**
 * boardMeetingService – Vorstandssitzungen verwalten.
 * Nutzt die existierende `meetings`-Tabelle.
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { fromSupabaseError, errors } from '@/lib/error';
import type { ApiResult } from '@/types/api';

// ── Typen ─────────────────────────────────────────────────────

export interface BoardMeetingUI {
  id: string;
  title: string;
  meetingDate: string;
  meetingTime: string | null;
  location: string | null;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardMeetingCreateDTO {
  title: string;
  meeting_date: string;
  meeting_time?: string | null;
  location?: string | null;
  description?: string | null;
  created_by: string;
}

export interface BoardMeetingUpdateDTO {
  title?: string;
  meeting_date?: string;
  meeting_time?: string | null;
  location?: string | null;
  description?: string | null;
}

// ── Mapping ───────────────────────────────────────────────────

type MeetingRow = {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time: string | null;
  location: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

function mapToUI(row: MeetingRow): BoardMeetingUI {
  return {
    id: row.id,
    title: row.title,
    meetingDate: row.meeting_date,
    meetingTime: row.meeting_time,
    location: row.location,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Service ───────────────────────────────────────────────────

export const boardMeetingService = {
  async listAll(): Promise<ApiResult<BoardMeetingUI[]>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .order('meeting_date', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as MeetingRow[]).map(mapToUI);
    }, fromSupabaseError);
  },

  async getById(id: string): Promise<ApiResult<BoardMeetingUI>> {
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return err(fromSupabaseError(error));
    if (!data) return err(errors.notFound('Sitzung', id));
    return ok(mapToUI(data as MeetingRow));
  },

  async create(payload: BoardMeetingCreateDTO): Promise<ApiResult<BoardMeetingUI>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('meetings')
        .insert({
          title: payload.title,
          meeting_date: payload.meeting_date,
          meeting_time: payload.meeting_time ?? null,
          location: payload.location ?? null,
          description: payload.description ?? null,
          created_by: payload.created_by,
        })
        .select()
        .single();
      if (error) throw error;
      return mapToUI(data as MeetingRow);
    }, fromSupabaseError);
  },

  async update(id: string, payload: BoardMeetingUpdateDTO): Promise<ApiResult<BoardMeetingUI>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('meetings')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return mapToUI(data as MeetingRow);
    }, fromSupabaseError);
  },

  async remove(id: string): Promise<ApiResult<void>> {
    const { error } = await supabase.from('meetings').delete().eq('id', id);
    if (error) return err(fromSupabaseError(error));
    return ok(undefined);
  },
};
