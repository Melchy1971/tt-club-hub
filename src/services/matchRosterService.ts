import { supabase } from '@/integrations/supabase/client';
import type { MatchAvailability, MatchLineup, MatchRosterView } from '@/types/matchRoster';
import type { MatchLineupSlot, MatchAvailabilityInput } from '@/schemas/matchRoster.schema';
import {
  matchAvailabilitySchema,
  matchLineupBulkSchema,
  matchLineupSlotSchema,
} from '@/schemas/matchRoster.schema';

const mapAvail = (row: any): MatchAvailability => row as MatchAvailability;
const mapLineup = (row: any): MatchLineup => row as MatchLineup;

const handleError = (error: any, context: string) => {
  const message = error?.message ?? 'Unbekannter Fehler';
  throw new Error(`[matchRosterService] ${context}: ${message}`);
};

export const matchRosterService = {
  async listAvailability(matchId: string): Promise<MatchAvailability[]> {
    const { data, error } = await supabase
      .from('match_availabilities')
      .select('*')
      .eq('match_id', matchId);
    if (error) handleError(error, 'listAvailability');
    return (data ?? []).map(mapAvail);
  },

  async upsertAvailability(input: MatchAvailabilityInput): Promise<MatchAvailability> {
    const parsed = matchAvailabilitySchema.parse(input);
    const { data, error } = await supabase
      .from('match_availabilities')
      .upsert(parsed, { onConflict: 'match_id,member_id' })
      .select()
      .single();
    if (error) handleError(error, 'upsertAvailability');
    return mapAvail(data);
  },

  async deleteAvailability(id: string): Promise<void> {
    const { error } = await supabase.from('match_availabilities').delete().eq('id', id);
    if (error) handleError(error, 'deleteAvailability');
  },

  async getLineup(matchId: string): Promise<MatchLineup[]> {
    const { data, error } = await supabase
      .from('match_lineups')
      .select('*')
      .eq('match_id', matchId)
      .order('position', { ascending: true });
    if (error) handleError(error, 'getLineup');
    return (data ?? []).map(mapLineup);
  },

  async setLineup(matchId: string, slots: Omit<MatchLineupSlot, 'match_id'>[]): Promise<MatchLineup[]> {
    const parsedBulk = matchLineupBulkSchema.parse({ match_id: matchId, slots });

    const { error: delError } = await supabase
      .from('match_lineups')
      .delete()
      .eq('match_id', matchId);
    if (delError) handleError(delError, 'setLineup delete old');

    const toInsert = parsedBulk.slots.map((s) => ({ ...s, match_id: matchId }));
    const { data, error } = await supabase
      .from('match_lineups')
      .insert(toInsert)
      .select()
      .order('position', { ascending: true });
    if (error) handleError(error, 'setLineup insert');
    return (data ?? []).map(mapLineup);
  },

  async buildRosterView(matchId: string, teamId: string): Promise<MatchRosterView> {
    const [teamMembers, avail, lineup] = await Promise.all([
      supabase
        .from('team_members')
        .select('members(*)')
        .eq('team_id', teamId),
      this.listAvailability(matchId),
      this.getLineup(matchId),
    ]);

    const membersRows = (teamMembers.data ?? []).map((tm: any) => tm.members).filter(Boolean);
    const roster = membersRows.map((m: any) => {
      const av = avail.find((a) => a.member_id === m.id);
      const slot = lineup.find((l) => l.member_id === m.id);
      return {
        member: {
          id: m.id,
          userId: m.user_id,
          firstName: m.first_name,
          lastName: m.last_name,
          fullName: `${m.first_name} ${m.last_name}`.trim(),
          email: m.email,
          phone: m.phone,
          city: m.city,
          zipCode: m.zip_code,
          street: m.street,
          memberNumber: m.member_number,
          ageGroup: m.age_group,
          entryDate: m.entry_date,
          exitDate: m.exit_date,
          isActive: m.is_active,
          ttr: m.ttr_rating,
          qttr: m.qttr_rating,
          createdAt: m.created_at,
          updatedAt: m.updated_at,
        },
        availability: av?.status,
        note: av?.note,
        inLineup: !!slot,
        position: slot?.position,
        isSubstitute: slot?.is_substitute,
      };
    });

    return { matchId, roster };
  },
};
