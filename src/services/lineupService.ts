/**
 * lineupService
 * Verwaltet match_lineups – die konkrete Aufstellung pro Spiel.
 *
 * Fachliche Regeln:
 * - Aufstellung getrennt von Verfügbarkeit
 * - nur Teamspieler der passenden season_phase
 * - Konflikte vor DB-Write erkennen
 */

import { supabase } from '@/integrations/supabase/client';
import { lineupSetSchema, type LineupSetInput } from '@/schemas/availability.schema';

export type MatchLineup = {
  id: string;
  match_id: string;
  team_id: string;
  member_id: string;
  position: number;
  is_substitute: boolean;
  created_at: string;
  updated_at: string;
};

type LineupValidationConflict =
  | 'duplicate_member'
  | 'duplicate_position'
  | 'wrong_team'
  | 'inactive_assignment'
  | 'missing_assignment';

class LineupValidationError extends Error {
  constructor(public readonly conflicts: { member_id?: string; position?: number; conflict: LineupValidationConflict }[]) {
    super('Ungültige Aufstellung');
    this.name = 'LineupValidationError';
  }
}

async function validateLineup(matchId: string, teamId: string, entries: LineupSetInput['entries']) {
  const conflicts: { member_id?: string; position?: number; conflict: LineupValidationConflict }[] = [];

  const memberCounts = new Map<string, number>();
  const positionCounts = new Map<number, number>();

  for (const entry of entries) {
    memberCounts.set(entry.member_id, (memberCounts.get(entry.member_id) ?? 0) + 1);
    positionCounts.set(entry.position, (positionCounts.get(entry.position) ?? 0) + 1);
  }

  for (const [memberId, count] of memberCounts.entries()) {
    if (count > 1) conflicts.push({ member_id: memberId, conflict: 'duplicate_member' });
  }
  for (const [position, count] of positionCounts.entries()) {
    if (count > 1) conflicts.push({ position, conflict: 'duplicate_position' });
  }

  const { data: match, error: matchError } = await supabase
    .from('schedule_matches')
    .select('id, team_id, season_phase_id')
    .eq('id', matchId)
    .single();
  if (matchError) throw matchError;

  if (match.team_id !== teamId) {
    conflicts.push({ conflict: 'wrong_team' });
  }

  const memberIds = Array.from(memberCounts.keys());
  if (memberIds.length > 0) {
    const { data: assignments, error: assignmentsError } = await supabase
      .from('team_members')
      .select('member_id, teams!inner(id, is_active, season_phase_id)')
      .eq('team_id', teamId)
      .in('member_id', memberIds);
    if (assignmentsError) throw assignmentsError;

    const byMember = new Map(assignments.map((a: any) => [a.member_id, a]));

    for (const memberId of memberIds) {
      const assignment: any = byMember.get(memberId);
      if (!assignment) {
        conflicts.push({ member_id: memberId, conflict: 'missing_assignment' });
        continue;
      }

      const team = assignment.teams;
      if (!team || team.id !== teamId) {
        conflicts.push({ member_id: memberId, conflict: 'wrong_team' });
        continue;
      }

      if (!team.is_active || team.season_phase_id !== match.season_phase_id) {
        conflicts.push({ member_id: memberId, conflict: 'inactive_assignment' });
      }
    }
  }

  if (conflicts.length > 0) throw new LineupValidationError(conflicts);
}

export const lineupService = {
  LineupValidationError,

  async getForMatch(matchId: string): Promise<MatchLineup[]> {
    const { data, error } = await supabase
      .from('match_lineups' as never)
      .select('*')
      .eq('match_id', matchId)
      .order('position', { ascending: true });
    if (error) throw error;
    return (data ?? []) as MatchLineup[];
  },

  async setLineup(input: LineupSetInput): Promise<MatchLineup[]> {
    const parsed = lineupSetSchema.parse(input);
    const matchId = parsed.match_id;

    await validateLineup(matchId, parsed.team_id, parsed.entries);

    const { error: deleteError } = await supabase
      .from('match_lineup')
      .delete()
      .eq('match_id', matchId);
    if (deleteError) throw deleteError;

    if (parsed.entries.length === 0) return [];

    const { data, error } = await supabase
      .from('match_lineups' as never)
      .insert(
        parsed.entries.map((e) => ({
          match_id: matchId,
          team_id: parsed.team_id,
          member_id: e.member_id,
          position: e.position,
          is_substitute: e.is_substitute,
        })),
      )
      .select('*');
    if (error) throw error;
    return (data ?? []) as MatchLineup[];
  },

  async removePlayer(matchId: string, memberId: string): Promise<void> {
    const { error } = await supabase
      .from('match_lineups' as never)
      .delete()
      .eq('match_id', matchId)
      .eq('member_id', memberId);
    if (error) throw error;
  },
};
