import { supabase } from '@/integrations/supabase/client';
import type { Team, TeamInsert, TeamUpdate, TeamMember, TeamMemberInsert } from '@/types';

export const teamService = {
  async getAll(): Promise<Team[]> {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getBySeason(seasonId: string): Promise<Team[]> {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('season_id', seasonId)
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<Team | null> {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(team: TeamInsert): Promise<Team> {
    const { data, error } = await supabase
      .from('teams')
      .insert(team)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: TeamUpdate): Promise<Team> {
    const { data, error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getMembers(teamId: string): Promise<TeamMember[]> {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .order('position', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async addMember(entry: TeamMemberInsert): Promise<TeamMember> {
    const { data, error } = await supabase
      .from('team_members')
      .insert(entry)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async removeMember(id: string): Promise<void> {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
