/**
 * boardMemberService
 *
 * Verwaltet Vorstandsmitglieder (Positionen, Amtszeiten).
 *
 * DB-Tabelle: board_members
 *   id          uuid PK
 *   member_id   uuid → members.id
 *   position    text  (Enum: BOARD_POSITIONS)
 *   since       date
 *   until       date | null
 *   is_active   boolean DEFAULT true
 *   notes       text | null
 *   created_at  timestamptz
 *   updated_at  timestamptz
 *
 * Zugriffsregeln:
 *   SELECT  → board:read  (vorstand, admin, developer)
 *   INSERT  → board:write (vorstand, admin, developer)
 *   UPDATE  → board:write (vorstand, admin, developer)
 *   DELETE  → board:delete (admin, developer)
 *
 * RLS-Empfehlung (Supabase):
 *   SELECT: EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('vorstand','admin','developer'))
 *   INSERT/UPDATE: gleiche Bedingung
 *   DELETE: role IN ('admin','developer')
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { fromSupabaseError, errors } from '@/lib/error';
import type { ApiResult } from '@/types/api';

// ── Konstanten ────────────────────────────────────────────────

export const BOARD_POSITIONS = [
  '1. Vorsitzender',
  '2. Vorsitzender',
  'Kassenwart',
  'Schriftführer',
  'Sportwart',
  'Jugendwart',
  'Pressewart',
  'Beisitzer',
] as const;

export type BoardPosition = (typeof BOARD_POSITIONS)[number];

// ── Typen ─────────────────────────────────────────────────────

export interface BoardMemberRow {
  id:         string;
  member_id:  string;
  position:   string;
  since:      string;
  until:      string | null;
  is_active:  boolean;
  notes:      string | null;
  created_at: string;
  updated_at: string;
}

export interface BoardMemberUI {
  id:        string;
  memberId:  string;
  position:  string;
  since:     string;
  until:     string | null;
  isActive:  boolean;
  notes:     string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoardMemberCreateDTO {
  member_id: string;
  position:  string;
  since:     string;
  until?:    string | null;
  is_active?: boolean;
  notes?:    string | null;
}

export interface BoardMemberUpdateDTO {
  position?:  string;
  since?:     string;
  until?:     string | null;
  is_active?: boolean;
  notes?:     string | null;
}

export interface BoardMemberFilter {
  is_active?: boolean;
  /** Nur Mitglieder einer bestimmten Position anzeigen */
  position?:  string;
}

// ── Mapping ───────────────────────────────────────────────────

function mapToUI(row: BoardMemberRow): BoardMemberUI {
  return {
    id:        row.id,
    memberId:  row.member_id,
    position:  row.position,
    since:     row.since,
    until:     row.until,
    isActive:  row.is_active,
    notes:     row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Service ───────────────────────────────────────────────────

export const boardMemberService = {
  /**
   * Alle Vorstandsmitglieder, optional gefiltert.
   * Standardmäßig nur aktive zurückgeben.
   */
  async list(filter: BoardMemberFilter = {}): Promise<ApiResult<BoardMemberUI[]>> {
    return tryCatch(async () => {
      let q = supabase
        .from('board_members')
        .select('*')
        .order('since', { ascending: false });

      if (filter.is_active !== undefined) q = q.eq('is_active', filter.is_active);
      if (filter.position)               q = q.eq('position', filter.position);

      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as BoardMemberRow[]).map(mapToUI);
    }, fromSupabaseError);
  },

  /** Nur aktuell aktiver Vorstand (Shortcut für Navigation/Öffentlichkeit). */
  listActive(): Promise<ApiResult<BoardMemberUI[]>> {
    return boardMemberService.list({ is_active: true });
  },

  async getById(id: string): Promise<ApiResult<BoardMemberUI>> {
    const { data, error } = await supabase
      .from('board_members')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return err(fromSupabaseError(error));
    if (!data)  return err(errors.notFound('Vorstandsmitglied', id));
    return ok(mapToUI(data as BoardMemberRow));
  },

  async create(payload: BoardMemberCreateDTO): Promise<ApiResult<BoardMemberUI>> {
    return tryCatch(async () => {
      const insert = {
        member_id: payload.member_id,
        position:  payload.position,
        since:     payload.since,
        until:     payload.until ?? null,
        is_active: payload.is_active ?? true,
        notes:     payload.notes ?? null,
      };
      const { data, error } = await supabase
        .from('board_members')
        .insert(insert)
        .select()
        .single();
      if (error) throw error;
      return mapToUI(data as BoardMemberRow);
    }, fromSupabaseError);
  },

  async update(id: string, payload: BoardMemberUpdateDTO): Promise<ApiResult<BoardMemberUI>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('board_members')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return mapToUI(data as BoardMemberRow);
    }, fromSupabaseError);
  },

  /** Beendet die Amtszeit (setzt until=today, is_active=false). */
  async deactivate(id: string, until: string): Promise<ApiResult<BoardMemberUI>> {
    return boardMemberService.update(id, { until, is_active: false });
  },

  async remove(id: string): Promise<ApiResult<void>> {
    const { error } = await supabase.from('board_members').delete().eq('id', id);
    if (error) return err(fromSupabaseError(error));
    return ok(undefined);
  },
};
