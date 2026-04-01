/**
 * boardMeetingService – Vorstandssitzungen verwalten.
 * Nutzt die existierende `meetings`-Tabelle.
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { fromSupabaseError, errors } from '@/lib/error';
import { boardAccessPolicy } from '@/services/boardAccessPolicy';
import type { ApiResult } from '@/types/api';
import type { BoardActorRole, BoardMeetingFilter } from '@/types/domain/board';

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
  visibility: 'internal';
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
    visibility: 'internal',
  };
}

function guard(role: BoardActorRole, action: 'read' | 'write' | 'delete'): ApiResult<void> {
  return boardAccessPolicy.authorize(role, { channel: 'meetings', visibility: 'internal' }, action);
}

// ── Service ───────────────────────────────────────────────────

export const boardMeetingService = {
  async list(filter: BoardMeetingFilter = {}): Promise<ApiResult<BoardMeetingUI[]>> {
    if (filter.visibility && filter.visibility !== 'internal') {
      return err(errors.validation('Board-Sitzungen sind ausschließlich intern.'));
    }

    return tryCatch(async () => {
      let query = supabase
        .from('meetings')
        .select('*')
        .order('meeting_date', { ascending: false });

      if (filter.from) query = query.gte('meeting_date', filter.from);
      if (filter.to) query = query.lte('meeting_date', filter.to);

      const limit = filter.limit ?? 100;
      if (filter.offset != null) {
        query = query.range(filter.offset, filter.offset + limit - 1);
      } else {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as MeetingRow[]).map(mapToUI);
    }, fromSupabaseError);
  },

  async listAll(): Promise<ApiResult<BoardMeetingUI[]>> {
    return boardMeetingService.list({ visibility: 'internal' });
  },

  async listForActor(role: BoardActorRole, filter: BoardMeetingFilter = {}): Promise<ApiResult<BoardMeetingUI[]>> {
    const auth = guard(role, 'read');
    if (!auth.ok) return auth;
    return boardMeetingService.list({ ...filter, visibility: 'internal' });
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

  async createForActor(role: BoardActorRole, payload: BoardMeetingCreateDTO): Promise<ApiResult<BoardMeetingUI>> {
    const auth = guard(role, 'write');
    if (!auth.ok) return auth;
    return boardMeetingService.create(payload);
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

  async updateForActor(role: BoardActorRole, id: string, payload: BoardMeetingUpdateDTO): Promise<ApiResult<BoardMeetingUI>> {
    const auth = guard(role, 'write');
    if (!auth.ok) return auth;
    return boardMeetingService.update(id, payload);
  },

  async remove(id: string): Promise<ApiResult<void>> {
    const { error } = await supabase.from('meetings').delete().eq('id', id);
    if (error) return err(fromSupabaseError(error));
    return ok(undefined);
  },

  async removeForActor(role: BoardActorRole, id: string): Promise<ApiResult<void>> {
    const auth = guard(role, 'delete');
    if (!auth.ok) return auth;
    return boardMeetingService.remove(id);
  },
};
