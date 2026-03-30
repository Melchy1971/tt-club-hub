/**
 * availabilityService
 * Verwaltet match_availability – Verfügbarkeit einzelner Spieler pro Spiel.
 */

import { supabase } from '@/integrations/supabase/client';
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

  async setStatus(input: {
    match_id: string;
    member_id: string;
    status: string;
    note?: string | null;
  }): Promise<MatchAvailability> {
    const { data, error } = await supabase
      .from('match_availability')
      .upsert(
        {
          match_id: input.match_id,
          member_id: input.member_id,
          status: input.status,
          note: input.note ?? null,
        },
        { onConflict: 'match_id,member_id' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return data;
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
