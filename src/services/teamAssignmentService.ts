/**
 * teamAssignmentService
 *
 * Verwaltet die Zuordnung von Spielern zu Mannschaften (team_members).
 *
 * DB-Constraints, die die Upsert-Logik prägen:
 *   UNIQUE(team_id, member_id)  – ein Spieler kann pro Team nur einmal eingetragen sein
 *   UNIQUE(team_id, position)   – pro Team ist jede Position nur einmal vergeben
 *   CHECK(position >= 0)        – 0 = keine feste Position
 *
 * Strategie für Konflikte:
 *   assign()      → ON CONFLICT(team_id, member_id) DO UPDATE position
 *                   → Wenn die Ziel-Position bereits belegt ist, wird CONFLICT zurückgegeben.
 *                      Der Aufrufer muss zuerst swapPositions() oder unassign() aufrufen.
 *   setRoster()   → DELETE + INSERT (nicht atomar; für Club-Apps ausreichend).
 *                   Für atomare Garantien → RPC-Funktion migrieren.
 *   swapPositions() → DELETE beide Zeilen, INSERT mit vertauschten Positionen.
 *                     Atomarizität nicht garantiert; Race Conditions bei parallelen
 *                     Requests unwahrscheinlich in diesem Use-Case.
 */

import { supabase } from '@/integrations/supabase/client';
import type { TeamMember } from '@/types';
import type { ApiResult, AppError } from '@/types/api';
import type { AssignmentWithMember } from '@/types/domain/team';
import { ok, err, tryCatch } from '@/lib/api';
import { errors, fromSupabaseError, getErrorMessage } from '@/lib/error';
import {
  teamAssignmentSchema,
  setRosterSchema,
} from '@/schemas/team.schema';
import type { SetRosterInput } from '@/schemas/team.schema';

// ─── Interner Fehler-Mapper (identisch zu teamService) ───────────────────────

const toAppError = (e: unknown): AppError => {
  if (e != null && typeof e === 'object' && 'code' in e && 'message' in e) {
    return e as AppError;
  }
  return errors.internal(getErrorMessage(e));
};

// ─── teamAssignmentService ────────────────────────────────────────────────────

export const teamAssignmentService = {
  /**
   * Gibt den vollständigen Kader einer Mannschaft zurück.
   *
   * Jeder Eintrag enthält die gejointen Mitglieds-Daten (members.*).
   * Die Liste ist aufsteigend nach Position sortiert.
   * Nutzt den impliziten Index von UNIQUE(team_id, position).
   */
  async getByTeam(teamId: string): Promise<ApiResult<AssignmentWithMember[]>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*, members(*)')
        .eq('team_id', teamId)
        .order('position', { ascending: true });
      if (error) throw fromSupabaseError(error);
      return (data ?? []) as unknown as AssignmentWithMember[];
    }, toAppError);
  },

  /**
   * Alle Teamzugehörigkeiten eines Spielers.
   *
   * Optionaler season_id-Filter – nutzt idx_team_members_member_team
   * und idx_teams_season_active für den anschließenden JOIN.
   */
  async getByMember(
    memberId: string,
    seasonId?: string,
  ): Promise<ApiResult<TeamMember[]>> {
    return tryCatch(async () => {
      let query = supabase
        .from('team_members')
        .select(seasonId ? '*, teams!inner(season_id)' : '*')
        .eq('member_id', memberId);

      if (seasonId) {
        query = query.eq('teams.season_id', seasonId);
      }

      const { data, error } = await query;
      if (error) throw fromSupabaseError(error);
      // teams-Join aus der Response entfernen; nur team_members-Felder zurückgeben.
      return (data ?? []).map(({ teams: _t, ...row }) => row as unknown as TeamMember);
    }, toAppError);
  },

  /**
   * Weist einen Spieler einer Mannschaft zu (Upsert).
   *
   * Verhalten:
   *   – Spieler noch nicht im Team  → INSERT
   *   – Spieler bereits im Team     → UPDATE position (ON CONFLICT DO UPDATE)
   *   – Ziel-Position bereits von anderem Spieler belegt → CONFLICT-Error
   *     → Aufrufer muss swapPositions() oder unassign() + assign() aufrufen.
   *
   * Nutzt den UNIQUE(team_id, member_id)-Index für den Upsert-Lookup.
   */
  async assign(
    teamId: string,
    memberId: string,
    position: number,
  ): Promise<ApiResult<TeamMember>> {
    const parsed = teamAssignmentSchema.safeParse({ team_id: teamId, member_id: memberId, position });
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.flatten()));
    }

    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('team_members')
        .upsert(
          { team_id: teamId, member_id: memberId, position },
          { onConflict: 'team_id,member_id' },
        )
        .select()
        .single();
      if (error) throw fromSupabaseError(error);
      return data as TeamMember;
    }, toAppError);
  },

  /**
   * Entfernt einen Spieler aus einer Mannschaft.
   * Nutzt den UNIQUE(team_id, member_id)-Index für den DELETE-Lookup.
   */
  async unassign(teamId: string, memberId: string): Promise<ApiResult<void>> {
    return tryCatch(async () => {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('member_id', memberId);
      if (error) throw fromSupabaseError(error);
    }, toAppError);
  },

  /**
   * Tauscht die Positionen zweier Spieler in derselben Mannschaft.
   *
   * Ablauf:
   *   1. Beide Zeilen lesen (Positionen ermitteln).
   *   2. Beide löschen (befreit die Positions-Slots vom UNIQUE-Constraint).
   *   3. Mit vertauschten Positionen neu einfügen.
   *
   * Nicht atomar: Im unwahrscheinlichen Fall eines gleichzeitigen Schreibzugriffs
   * kann Schritt 3 scheitern. Bei Scheitern bleiben die Spieler ohne Zuordnung.
   * Für strenge Garantien → DB-RPC-Funktion verwenden.
   */
  async swapPositions(
    teamId: string,
    memberId1: string,
    memberId2: string,
  ): Promise<ApiResult<void>> {
    if (memberId1 === memberId2) {
      return err(errors.validation('Beide Spieler müssen unterschiedlich sein'));
    }

    return tryCatch(async () => {
      // 1. Aktuelle Positionen lesen
      const { data: rows, error: fetchError } = await supabase
        .from('team_members')
        .select('member_id, position')
        .eq('team_id', teamId)
        .in('member_id', [memberId1, memberId2]);

      if (fetchError) throw fromSupabaseError(fetchError);
      if (!rows || rows.length !== 2) {
        throw errors.notFound(
          'Einer oder beide Spieler sind nicht in dieser Mannschaft',
        );
      }

      const a = rows.find((r) => r.member_id === memberId1)!;
      const b = rows.find((r) => r.member_id === memberId2)!;

      // 2. Beide Zeilen löschen → gibt Positions-Slots frei
      const { error: deleteError } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .in('member_id', [memberId1, memberId2]);

      if (deleteError) throw fromSupabaseError(deleteError);

      // 3. Mit getauschten Positionen neu einfügen
      const { error: insertError } = await supabase
        .from('team_members')
        .insert([
          { team_id: teamId, member_id: a.member_id, position: b.position },
          { team_id: teamId, member_id: b.member_id, position: a.position },
        ]);

      if (insertError) throw fromSupabaseError(insertError);
    }, toAppError);
  },

  /**
   * Ersetzt den gesamten Kader einer Mannschaft atomisch (so weit JS-seitig möglich).
   *
   * Ablauf:
   *   1. Alle bestehenden Zuordnungen für das Team löschen.
   *   2. Neuen Kader einfügen.
   *
   * Validierung vor dem Schreiben:
   *   – Positionen müssen eindeutig sein (Zod-Schema).
   *   – Maximal 20 Spieler.
   *
   * Wenn entries leer ist, werden nur bestehende Einträge gelöscht.
   */
  async setRoster(
    teamId: string,
    entries: SetRosterInput,
  ): Promise<ApiResult<TeamMember[]>> {
    const parsed = setRosterSchema.safeParse(entries);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.flatten()));
    }

    return tryCatch(async () => {
      // 1. Bestehende Zuordnungen löschen
      const { error: deleteError } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId);

      if (deleteError) throw fromSupabaseError(deleteError);

      if (parsed.data.length === 0) return [];

      // 2. Neuen Kader einfügen
      const { data, error: insertError } = await supabase
        .from('team_members')
        .insert(
          parsed.data.map((entry) => ({
            team_id: teamId,
            member_id: entry.member_id,
            position: entry.position,
          })),
        )
        .select();

      if (insertError) throw fromSupabaseError(insertError);
      return (data ?? []) as TeamMember[];
    }, toAppError);
  },

  /**
   * Liefert alle Vereinsmitglieder, die noch NICHT in der angegebenen Mannschaft sind.
   * Nützlich für das UI-Auswahlmenü beim Hinzufügen von Spielern.
   *
   * Nutzt idx_team_members_member und idx_members_active_ttr.
   * Gibt nur aktive Mitglieder zurück, sortiert nach TTR (absteigend).
   */
  async getAvailableMembers(
    teamId: string,
  ): Promise<ApiResult<Array<{ id: string; first_name: string; last_name: string; ttr_rating: number | null }>>> {
    return tryCatch(async () => {
      // Aktuell zugeordnete member_ids laden (kleines Result-Set)
      const { data: existing, error: existingError } = await supabase
        .from('team_members')
        .select('member_id')
        .eq('team_id', teamId);

      if (existingError) throw fromSupabaseError(existingError);

      const assignedIds = (existing ?? []).map((r) => r.member_id);

      // Alle aktiven Mitglieder, die nicht zugeordnet sind
      let query = supabase
        .from('members')
        .select('id, first_name, last_name, ttr_rating')
        .eq('is_active', true)
        .order('ttr_rating', { ascending: false, nullsFirst: false })
        .order('last_name', { ascending: true });

      if (assignedIds.length > 0) {
        query = query.not('id', 'in', `(${assignedIds.join(',')})`);
      }

      const { data, error } = await query;
      if (error) throw fromSupabaseError(error);
      return data ?? [];
    }, toAppError);
  },
};
