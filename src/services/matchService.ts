import { supabase } from '@/integrations/supabase/client';
import type { ScheduleMatch, ScheduleMatchInsert, ScheduleMatchUpdate } from '@/types';

export const matchService = {
  async getAll(): Promise<ScheduleMatch[]> {
    const { data, error } = await supabase
      .from('schedule_matches')
      .select('*')
      .order('match_date', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getByTeam(teamId: string): Promise<ScheduleMatch[]> {
    const { data, error } = await supabase
      .from('schedule_matches')
      .select('*')
      .eq('team_id', teamId)
      .order('match_date', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getBySeason(seasonId: string): Promise<ScheduleMatch[]> {
    const { data, error } = await supabase
      .from('schedule_matches')
      .select('*')
      .eq('season_id', seasonId)
      .order('match_date', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<ScheduleMatch | null> {
    const { data, error } = await supabase
      .from('schedule_matches')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(match: ScheduleMatchInsert): Promise<ScheduleMatch> {
    const { data, error } = await supabase
      .from('schedule_matches')
      .insert(match)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: ScheduleMatchUpdate): Promise<ScheduleMatch> {
    const { data, error } = await supabase
      .from('schedule_matches')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('schedule_matches')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
