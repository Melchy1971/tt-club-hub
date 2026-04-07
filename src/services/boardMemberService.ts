/**
 * boardMemberService – Vorstandsmitglieder verwalten.
 *
 * Trennung der Daten:
 * - board_members: vorstandsspezifische Amtsdaten
 * - members: allgemeine Mitglieds-Profildaten
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { fromSupabaseError, errors } from '@/lib/error';
import type { ApiResult } from '@/types/api';
import type { BoardActorRole, BoardMemberFilter } from '@/types/domain/board';

const BOARD_MEMBERS_TABLE = 'board_members';

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

export interface BoardMemberUI {
  id: string;
  userId: string;
  memberId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  role: string;
  position: string;
  termStart: string | null;
  termEnd: string | null;
  isActive: boolean;
  notes: string | null;
}

export interface BoardMemberCreateDTO {
  user_id: string;
  member_id?: string | null;
  position: string;
  term_start?: string | null;
  term_end?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface BoardMemberUpdateDTO {
  member_id?: string | null;
  position?: string;
  term_start?: string | null;
  term_end?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

type BoardMemberRow = {
  id: string;
  user_id: string;
  member_id: string | null;
  position: string;
  term_start: string | null;
  term_end: string | null;
  notes: string | null;
  is_active: boolean;
};

type MemberRow = {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
};

function canReadBoardMembers(role: BoardActorRole): boolean {
  return role === 'admin' || role === 'developer' || role === 'vorstand';
}

function canWriteBoardMembers(role: BoardActorRole): boolean {
  return role === 'admin' || role === 'developer' || role === 'vorstand';
}

function canDeleteBoardMembers(role: BoardActorRole): boolean {
  return role === 'admin' || role === 'developer';
}

export const boardMemberService = {
  async list(filter: BoardMemberFilter = {}): Promise<ApiResult<BoardMemberUI[]>> {
    return tryCatch(async () => {
      let query = (supabase as any)
        .from(BOARD_MEMBERS_TABLE)
        .select('id, user_id, member_id, position, term_start, term_end, notes, is_active')
        .order('position', { ascending: true });

      if (filter.activeOnly ?? true) {
        query = query.eq('is_active', true);
      }

      const { data: boardRows, error: boardErr } = await query;
      if (boardErr) throw boardErr;
      if (!boardRows || boardRows.length === 0) return [];

      const userIds = (boardRows as BoardMemberRow[]).map((r) => r.user_id);

      const [{ data: roles, error: roleErr }, { data: members, error: memErr }] = await Promise.all([
        supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
        supabase.from('members').select('id, user_id, first_name, last_name, email').in('user_id', userIds),
      ]);

      if (roleErr) throw roleErr;
      if (memErr) throw memErr;

      const roleMap = new Map<string, string>();
      (roles ?? []).forEach((r) => {
        if (!roleMap.has(r.user_id) || r.role === 'admin') {
          roleMap.set(r.user_id, r.role);
        }
      });

      const memberMap = new Map<string, MemberRow>();
      ((members ?? []) as MemberRow[]).forEach((m) => {
        if (m.user_id) memberMap.set(m.user_id, m);
      });

      return (boardRows as BoardMemberRow[]).map((row) => {
        const member = memberMap.get(row.user_id);
        return {
          id: row.id,
          userId: row.user_id,
          memberId: row.member_id ?? member?.id ?? null,
          firstName: member?.first_name ?? '',
          lastName: member?.last_name ?? '',
          email: member?.email ?? null,
          role: roleMap.get(row.user_id) ?? 'vorstand',
          position: row.position,
          termStart: row.term_start,
          termEnd: row.term_end,
          isActive: row.is_active,
          notes: row.notes,
        };
      });
    }, fromSupabaseError);
  },

  async listActive(): Promise<ApiResult<BoardMemberUI[]>> {
    return boardMemberService.list({ activeOnly: true });
  },

  async listForActor(role: BoardActorRole, filter: BoardMemberFilter = {}): Promise<ApiResult<BoardMemberUI[]>> {
    if (!canReadBoardMembers(role)) {
      return err(errors.forbidden('board-members:read'));
    }
    return boardMemberService.list(filter);
  },

  async listActiveForActor(role: BoardActorRole): Promise<ApiResult<BoardMemberUI[]>> {
    return boardMemberService.listForActor(role, { activeOnly: true });
  },

  async createForActor(role: BoardActorRole, payload: BoardMemberCreateDTO): Promise<ApiResult<BoardMemberUI>> {
    if (!canWriteBoardMembers(role)) return err(errors.forbidden('board-members:write'));

    const { data, error } = await (supabase as any)
      .from(BOARD_MEMBERS_TABLE)
      .insert({
        user_id: payload.user_id,
        member_id: payload.member_id ?? null,
        position: payload.position,
        term_start: payload.term_start ?? null,
        term_end: payload.term_end ?? null,
        notes: payload.notes ?? null,
        is_active: payload.is_active ?? true,
      })
      .select('id, user_id, member_id, position, term_start, term_end, notes, is_active')
      .single();

    if (error) return err(fromSupabaseError(error));

    const listed = await boardMemberService.list({ activeOnly: false });
    if (!listed.success) return listed as ApiResult<BoardMemberUI>;
    const created = listed.data.find((m) => m.id === (data as BoardMemberRow).id);
    if (!created) return err(errors.notFound('Vorstandsmitglied', (data as BoardMemberRow).id));
    return ok(created);
  },

  async updateForActor(role: BoardActorRole, id: string, payload: BoardMemberUpdateDTO): Promise<ApiResult<BoardMemberUI>> {
    if (!canWriteBoardMembers(role)) return err(errors.forbidden('board-members:write'));

    const { error } = await (supabase as any)
      .from(BOARD_MEMBERS_TABLE)
      .update(payload)
      .eq('id', id);

    if (error) return err(fromSupabaseError(error));

    const listed = await boardMemberService.list({ activeOnly: false });
    if (!listed.success) return listed as ApiResult<BoardMemberUI>;
    const updated = listed.data.find((m) => m.id === id);
    if (!updated) return err(errors.notFound('Vorstandsmitglied', id));
    return ok(updated);
  },

  async removeForActor(role: BoardActorRole, id: string): Promise<ApiResult<void>> {
    if (!canDeleteBoardMembers(role)) return err(errors.forbidden('board-members:delete'));

    const { error } = await (supabase as any).from(BOARD_MEMBERS_TABLE).delete().eq('id', id);
    if (error) return err(fromSupabaseError(error));
    return ok(undefined);
  },
};
