/**
 * availabilityService
 * Verwaltet match_player_availability – Verfügbarkeit einzelner Spieler pro Spiel.
 *
 * Fachliche Regeln:
 * - nur Spieler der Match-Mannschaft in derselben season_phase
 * - Team/Mannschaft muss aktiv sein
 * - Konflikte: Duplikate, falsche Mannschaft, inaktive Zuordnung
 */

import { supabase } from '@/integrations/supabase/client';
import {
  availabilityBulkSchema,
  availabilitySetSchema,
  type AvailabilityBulkInput,
  type AvailabilitySetInput,
} from '@/schemas/availability.schema';

export type MatchPlayerAvailability = {
  id: string;
  match_id: string;
  member_id: string;
  team_id: string;
  status: 'unknown' | 'available' | 'unavailable';
  note: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type AssignmentValidationConflict =
  | 'duplicate_member'
  | 'wrong_team'
  | 'inactive_assignment'
  | 'missing_assignment';

class AssignmentValidationError extends Error {
  constructor(public readonly conflicts: { member_id: string; conflict: AssignmentValidationConflict }[]) {
    super('Ungültige Verfügbarkeits-Einträge');
    this.name = 'AssignmentValidationError';
  }
}

async function validateMembersForMatch(matchId: string, teamId: string, memberIds: string[]) {
  const uniqueMemberIds = Array.from(new Set(memberIds));
  const conflicts: { member_id: string; conflict: AssignmentValidationConflict }[] = [];

  if (uniqueMemberIds.length !== memberIds.length) {
    const counts = new Map<string, number>();
    for (const memberId of memberIds) counts.set(memberId, (counts.get(memberId) ?? 0) + 1);
    for (const [memberId, count] of counts.entries()) {
      if (count > 1) conflicts.push({ member_id: memberId, conflict: 'duplicate_member' });
    }
  }

  const { data: match, error: matchError } = await supabase
    .from('schedule_matches')
    .select('id, team_id, season_phase_id')
    .eq('id', matchId)
    .single();
  if (matchError) throw matchError;

  if (match.team_id !== teamId) {
    throw new AssignmentValidationError(uniqueMemberIds.map((member_id) => ({ member_id, conflict: 'wrong_team' })));
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from('team_members')
    .select('member_id, teams!inner(id, is_active, season_phase_id)')
    .eq('team_id', teamId)
    .in('member_id', uniqueMemberIds);

  if (assignmentsError) throw assignmentsError;

  const byMember = new Map(assignments.map((a: any) => [a.member_id, a]));

  for (const memberId of uniqueMemberIds) {
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

  if (conflicts.length > 0) {
    throw new AssignmentValidationError(conflicts);
  }
}

export const availabilityService = {
  AssignmentValidationError,

  async getForMatch(matchId: string): Promise<MatchPlayerAvailability[]> {
    const { data, error } = await supabase
      .from('match_availability')
      .select('*')
      .eq('match_id', matchId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as MatchPlayerAvailability[];
  },

  async setStatus(input: AvailabilitySetInput): Promise<MatchPlayerAvailability> {
    const parsed = availabilitySetSchema.parse(input);
    await validateMembersForMatch(parsed.match_id, parsed.team_id, [parsed.member_id]);

    const { data, error } = await supabase
      .from('match_availability')
      .upsert(
        {
          match_id: parsed.match_id,
          member_id: parsed.member_id,
          status: parsed.status,
          note: parsed.note ?? null,
        } as any,
        { onConflict: 'match_id,member_id' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return data as MatchPlayerAvailability;
  },

  async bulkSet(input: AvailabilityBulkInput): Promise<MatchPlayerAvailability[]> {
    const parsed = availabilityBulkSchema.parse(input);
    if (parsed.entries.length === 0) return [];

    await validateMembersForMatch(
      parsed.match_id,
      parsed.team_id,
      parsed.entries.map((entry) => entry.member_id),
    );

    const payload = parsed.entries.map((entry) => ({
      match_id: parsed.match_id,
      team_id: parsed.team_id,
      member_id: entry.member_id,
      status: entry.status,
      note: entry.note ?? null,
    }));

    const { data, error } = await supabase
      .from('match_availability')
      .upsert(payload as any, { onConflict: 'match_id,member_id' })
      .select('*');
    if (error) throw error;
    return (data ?? []) as MatchPlayerAvailability[];
  },

  async remove(matchId: string, memberId: string): Promise<void> {
    const { error } = await supabase
      .from('match_availability')
      .delete()
      .eq('match_id', matchId)
      .eq('member_id', memberId);
    if (error) throw error;
  },
};
