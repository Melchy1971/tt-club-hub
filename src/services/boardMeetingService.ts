/**
 * boardMeetingService
 *
 * Verwaltet Vorstandssitzungen (Planung, Protokoll, Öffentlichkeit).
 *
 * DB-Tabelle: board_meetings
 *   id           uuid PK
 *   title        text
 *   meeting_date date
 *   meeting_time time | null
 *   location     text | null
 *   status       text  ('planned' | 'held' | 'cancelled')
 *   agenda       text | null   ← intern / nicht-öffentlich
 *   minutes      text | null   ← intern / nicht-öffentlich
 *   is_public    boolean DEFAULT false
 *   created_by   uuid → members.id | null
 *   created_at   timestamptz
 *   updated_at   timestamptz
 *
 * Sichtbarkeitsregeln:
 *   - is_public = false → nur board:read (Vorstand, Admin, Developer)
 *     agenda + minutes sind IMMER intern; werden in listPublic() weggelassen
 *   - is_public = true  → Basisdaten für alle sichtbar (Titel, Datum, Ort, Status)
 *     agenda + minutes bleiben weiterhin intern
 *
 * Zugriffsregeln:
 *   SELECT (intern)  → board:read
 *   SELECT (public)  → kein Login nötig (öffentliche Sitzungen)
 *   INSERT/UPDATE    → board:write
 *   DELETE           → board:delete
 *
 * RLS-Empfehlung:
 *   SELECT: is_public = true
 *        OR EXISTS (... role IN ('vorstand','admin','developer'))
 *   INSERT/UPDATE: role IN ('vorstand','admin','developer')
 *   DELETE: role IN ('admin','developer')
 *
 * WICHTIG – kein Datenleck bei agenda/minutes:
 *   listPublic() und getPublic() geben agenda + minutes NICHT zurück.
 *   Für volle Daten muss listAll() / getById() verwendet werden,
 *   die ausschließlich von Callers mit board:read aufgerufen werden dürfen.
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { fromSupabaseError, errors } from '@/lib/error';
import type { ApiResult } from '@/types/api';

// ── Konstanten ────────────────────────────────────────────────

export const MEETING_STATUSES = ['planned', 'held', 'cancelled'] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

// ── Typen ─────────────────────────────────────────────────────

/** Vollständige DB-Zeile – nur für board:read. */
export interface BoardMeetingRow {
  id:           string;
  title:        string;
  meeting_date: string;
  meeting_time: string | null;
  location:     string | null;
  status:       MeetingStatus;
  agenda:       string | null;
  minutes:      string | null;
  is_public:    boolean;
  created_by:   string | null;
  created_at:   string;
  updated_at:   string;
}

/** Vollständiges UI-Modell (nur für board:read verwenden). */
export interface BoardMeetingUI {
  id:          string;
  title:       string;
  meetingDate: string;
  meetingTime: string | null;
  location:    string | null;
  status:      MeetingStatus;
  agenda:      string | null;
  minutes:     string | null;
  isPublic:    boolean;
  createdBy:   string | null;
  createdAt:   string;
  updatedAt:   string;
}

/**
 * Öffentliche Kurzansicht – agenda + minutes absichtlich weggelassen.
 * Darf auch an nicht-eingeloggte Nutzer übermittelt werden.
 */
export interface BoardMeetingPublicUI {
  id:          string;
  title:       string;
  meetingDate: string;
  meetingTime: string | null;
  location:    string | null;
  status:      MeetingStatus;
  isPublic:    true;
}

export interface BoardMeetingCreateDTO {
  title:        string;
  meeting_date: string;
  meeting_time?: string | null;
  location?:    string | null;
  status?:      MeetingStatus;
  agenda?:      string | null;
  minutes?:     string | null;
  is_public?:   boolean;
  created_by?:  string | null;
}

export interface BoardMeetingUpdateDTO {
  title?:        string;
  meeting_date?: string;
  meeting_time?: string | null;
  location?:     string | null;
  status?:       MeetingStatus;
  agenda?:       string | null;
  minutes?:      string | null;
  is_public?:    boolean;
}

export interface BoardMeetingFilter {
  status?:    MeetingStatus;
  is_public?: boolean;
  /** ISO-Datum (YYYY-MM-DD) — nur Sitzungen ab diesem Tag */
  from?:      string;
  /** ISO-Datum (YYYY-MM-DD) — nur Sitzungen bis zu diesem Tag */
  until?:     string;
}

// ── Mapping ───────────────────────────────────────────────────

function mapToUI(row: BoardMeetingRow): BoardMeetingUI {
  return {
    id:          row.id,
    title:       row.title,
    meetingDate: row.meeting_date,
    meetingTime: row.meeting_time,
    location:    row.location,
    status:      row.status,
    agenda:      row.agenda,
    minutes:     row.minutes,
    isPublic:    row.is_public,
    createdBy:   row.created_by,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

function mapToPublicUI(row: BoardMeetingRow): BoardMeetingPublicUI {
  return {
    id:          row.id,
    title:       row.title,
    meetingDate: row.meeting_date,
    meetingTime: row.meeting_time,
    location:    row.location,
    status:      row.status,
    isPublic:    true,
  };
}

// ── Service ───────────────────────────────────────────────────

export const boardMeetingService = {
  /**
   * Alle Sitzungen (intern + öffentlich) mit vollem Datensatz.
   * NUR für Caller mit board:read aufrufen.
   */
  async listAll(filter: BoardMeetingFilter = {}): Promise<ApiResult<BoardMeetingUI[]>> {
    return tryCatch(async () => {
      let q = supabase
        .from('board_meetings')
        .select('*')
        .order('meeting_date', { ascending: false });

      if (filter.status)    q = q.eq('status', filter.status);
      if (filter.is_public !== undefined) q = q.eq('is_public', filter.is_public);
      if (filter.from)      q = q.gte('meeting_date', filter.from);
      if (filter.until)     q = q.lte('meeting_date', filter.until);

      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as BoardMeetingRow[]).map(mapToUI);
    }, fromSupabaseError);
  },

  /**
   * Nur öffentliche Sitzungen — agenda + minutes werden NICHT übermittelt.
   * Sicher für alle Rollen inkl. unauthenticated.
   */
  async listPublic(filter: Omit<BoardMeetingFilter, 'is_public'> = {}): Promise<ApiResult<BoardMeetingPublicUI[]>> {
    return tryCatch(async () => {
      let q = supabase
        .from('board_meetings')
        .select('id, title, meeting_date, meeting_time, location, status, is_public')
        .eq('is_public', true)
        .order('meeting_date', { ascending: false });

      if (filter.status) q = q.eq('status', filter.status);
      if (filter.from)   q = q.gte('meeting_date', filter.from);
      if (filter.until)  q = q.lte('meeting_date', filter.until);

      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as BoardMeetingRow[]).map(mapToPublicUI);
    }, fromSupabaseError);
  },

  /** Vollständiger Datensatz — NUR für board:read. */
  async getById(id: string): Promise<ApiResult<BoardMeetingUI>> {
    const { data, error } = await supabase
      .from('board_meetings')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return err(fromSupabaseError(error));
    if (!data)  return err(errors.notFound('Vorstandssitzung', id));
    return ok(mapToUI(data as BoardMeetingRow));
  },

  /**
   * Öffentlicher Datensatz einer einzelnen Sitzung.
   * Gibt FORBIDDEN zurück, wenn die Sitzung nicht öffentlich ist.
   */
  async getPublic(id: string): Promise<ApiResult<BoardMeetingPublicUI>> {
    const { data, error } = await supabase
      .from('board_meetings')
      .select('id, title, meeting_date, meeting_time, location, status, is_public')
      .eq('id', id)
      .eq('is_public', true)
      .maybeSingle();
    if (error) return err(fromSupabaseError(error));
    if (!data)  return err(errors.notFound('Vorstandssitzung', id));
    return ok(mapToPublicUI(data as BoardMeetingRow));
  },

  async create(payload: BoardMeetingCreateDTO): Promise<ApiResult<BoardMeetingUI>> {
    return tryCatch(async () => {
      const insert = {
        title:        payload.title,
        meeting_date: payload.meeting_date,
        meeting_time: payload.meeting_time ?? null,
        location:     payload.location ?? null,
        status:       payload.status ?? 'planned',
        agenda:       payload.agenda ?? null,
        minutes:      payload.minutes ?? null,
        is_public:    payload.is_public ?? false,
        created_by:   payload.created_by ?? null,
      };
      const { data, error } = await supabase
        .from('board_meetings')
        .insert(insert)
        .select()
        .single();
      if (error) throw error;
      return mapToUI(data as BoardMeetingRow);
    }, fromSupabaseError);
  },

  async update(id: string, payload: BoardMeetingUpdateDTO): Promise<ApiResult<BoardMeetingUI>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('board_meetings')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return mapToUI(data as BoardMeetingRow);
    }, fromSupabaseError);
  },

  /** Setzt Status auf 'held' und speichert das Protokoll. */
  async finalize(id: string, minutes: string): Promise<ApiResult<BoardMeetingUI>> {
    return boardMeetingService.update(id, { status: 'held', minutes });
  },

  /** Macht die Sitzung öffentlich sichtbar (ohne agenda/minutes preiszugeben). */
  async publish(id: string): Promise<ApiResult<BoardMeetingUI>> {
    return boardMeetingService.update(id, { is_public: true });
  },

  async remove(id: string): Promise<ApiResult<void>> {
    const { error } = await supabase.from('board_meetings').delete().eq('id', id);
    if (error) return err(fromSupabaseError(error));
    return ok(undefined);
  },
};
