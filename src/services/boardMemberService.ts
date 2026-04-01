/**
 * boardMemberService – Vorstandsmitglieder verwalten.
 *
 * Da keine separate board_members-Tabelle existiert, werden
 * Vorstandsmitglieder über die user_roles-Tabelle mit der Rolle
 * 'vorstand' identifiziert und die Mitgliederdaten aus der
 * members-Tabelle geladen.
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { fromSupabaseError, errors } from '@/lib/error';
import type { ApiResult } from '@/types/api';
import type { BoardActorRole } from '@/types/domain/board';

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

export interface BoardMemberUI {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  role: string;
}

// ── Service ───────────────────────────────────────────────────



function canReadBoardMembers(role: BoardActorRole): boolean {
  return role === 'admin' || role === 'developer' || role === 'vorstand';
}

export const boardMemberService = {
  /**
   * Lädt alle Mitglieder mit Vorstandsrolle.
   */
  async listActive(): Promise<ApiResult<BoardMemberUI[]>> {
    return tryCatch(async () => {
      // Get user_ids with vorstand or admin role
      const { data: roleData, error: roleErr } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['vorstand', 'admin']);
      if (roleErr) throw roleErr;

      if (!roleData || roleData.length === 0) return [];

      const userIds = roleData.map((r) => r.user_id);

      // Get member data for those users
      const { data: members, error: memErr } = await supabase
        .from('members')
        .select('id, user_id, first_name, last_name, email')
        .in('user_id', userIds);
      if (memErr) throw memErr;

      const roleMap = new Map<string, string>();
      roleData.forEach((r) => roleMap.set(r.user_id, r.role));

      return (members ?? []).map((m) => ({
        id: m.id,
        userId: m.user_id ?? '',
        firstName: m.first_name,
        lastName: m.last_name,
        email: m.email,
        role: roleMap.get(m.user_id ?? '') ?? 'vorstand',
      }));
    }, fromSupabaseError);
  },


  async listActiveForActor(role: BoardActorRole): Promise<ApiResult<BoardMemberUI[]>> {
    if (!canReadBoardMembers(role)) {
      return err(errors.forbidden('board-members:read'));
    }
    return boardMemberService.listActive();
  },
};
