/**
 * lineupService
 * Verwaltet match_lineup – die konkrete Aufstellung pro Spiel.
 */

import { supabase } from '@/integrations/supabase/client';
import { lineupSetSchema, type LineupSetInput } from '@/schemas/availability.schema';
import type { MatchLineup } from '@/types';

export const lineupService = {
  async getForMatch(matchId: string): Promise<MatchLineup[]> {
    const { data, error } = await supabase
      .from('match_lineup')
      .select('*')
      .eq('match_id', matchId)
      .order('position', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async setLineup(input: LineupSetInput): Promise<MatchLineup[]> {
    const parsed = lineupSetSchema.parse(input);
    const matchId = parsed.match_id;
    const entries = parsed.entries;

    // Delete existing
    const { error: deleteError } = await supabase
      .from('match_lineup')
      .delete()
      .eq('match_id', matchId);
    if (deleteError) throw deleteError;

    if (entries.length === 0) return [];

    const { data, error } = await supabase
      .from('match_lineup')
      .insert(entries.map((e) => ({ match_id: matchId, ...e })))
      .select('*');
    if (error) throw error;
    return data ?? [];
  },

  async removePlayer(matchId: string, memberId: string): Promise<void> {
    const { error } = await supabase
      .from('match_lineup')
      .delete()
      .eq('match_id', matchId)
      .eq('member_id', memberId);
    if (error) throw error;
  },
};
