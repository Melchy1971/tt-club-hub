/**
 * substituteService – simplified to match actual DB schema.
 * Table: substitute_requests with columns:
 *   id, match_id, team_id, requesting_member_id, substitute_member_id,
 *   status (pending|accepted|rejected), created_by, note, created_at, updated_at
 */

import { supabase } from '@/integrations/supabase/client';

export interface SubstituteRequestRow {
  id: string;
  match_id: string;
  team_id: string;
  requesting_member_id: string;
  substitute_member_id: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_by: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export const substituteService = {
  async list(matchIds?: string[]): Promise<SubstituteRequestRow[]> {
    let q = supabase.from('substitute_requests').select('*').order('created_at', { ascending: false });
    if (matchIds?.length) q = q.in('match_id', matchIds);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as SubstituteRequestRow[];
  },

  async create(input: {
    match_id: string;
    team_id: string;
    requesting_member_id: string;
    note?: string | null;
    created_by: string;
  }): Promise<SubstituteRequestRow> {
    const { data, error } = await supabase
      .from('substitute_requests')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data as SubstituteRequestRow;
  },

  async updateStatus(id: string, status: 'accepted' | 'rejected', substituteMemberId?: string): Promise<void> {
    const updates: Record<string, unknown> = { status };
    if (substituteMemberId) updates.substitute_member_id = substituteMemberId;
    const { error } = await supabase.from('substitute_requests').update(updates).eq('id', id);
    if (error) throw error;
  },

  async assignSubstitute(id: string, memberId: string): Promise<void> {
    const { error } = await supabase
      .from('substitute_requests')
      .update({ substitute_member_id: memberId })
      .eq('id', id);
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('substitute_requests').delete().eq('id', id);
    if (error) throw error;
  },
};
