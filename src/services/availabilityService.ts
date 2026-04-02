/**
 * availabilityService
 * Verwaltet match_availability – Verfügbarkeit einzelner Spieler pro Spiel.
 */

import { supabase } from '@/integrations/supabase/client';
import { availabilityBulkSchema, availabilitySetSchema, type AvailabilityBulkInput, type AvailabilitySetInput } from '@/schemas/availability.schema';
import type { MatchAvailability } from '@/types';

export const availabilityService = {
  async getForMatch(matchId: string): Promise<MatchAvailability[]> {
    const { data, error } = await supabase
      .from('match_availability')
      .select('*')
      .eq('match_id', matchId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async setStatus(input: AvailabilitySetInput): Promise<MatchAvailability> {
    const parsed = availabilitySetSchema.parse(input);
    const { data, error } = await supabase
      .from('match_availability')
      .upsert(
        {
          match_id: parsed.match_id,
          member_id: parsed.member_id,
          team_id: parsed.team_id,
          status: parsed.status,
          note: parsed.note ?? null,
        },
        { onConflict: 'match_id,member_id' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async bulkSet(input: AvailabilityBulkInput): Promise<MatchAvailability[]> {
    const parsed = availabilityBulkSchema.parse(input);
    if (parsed.entries.length === 0) return [];
    const payload = parsed.entries.map((entry) => ({
      match_id: parsed.match_id,
      team_id: parsed.team_id,
      member_id: entry.member_id,
      status: entry.status,
      note: entry.note ?? null,
    }));
    const { data, error } = await supabase
      .from('match_availability')
      .upsert(payload, { onConflict: 'match_id,member_id' })
      .select('*');
    if (error) throw error;
    return data ?? [];
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
