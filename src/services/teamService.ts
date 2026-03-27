import { supabase } from '@/integrations/supabase/client';
import { err, ok } from '@/lib/api';
import { fromSupabaseError } from '@/lib/error';
import type { ApiResult, TeamId } from '@/types/api';
import type { Team, TeamCreate, TeamMember, TeamUpdate } from '@/types/domain/team';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cast = <T>(v: unknown): T => v as T;

export const teamService = {
  async getAll(): Promise<ApiResult<Team[]>> {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('name');
    if (error) return err(fromSupabaseError(error));
    return ok(cast<Team[]>(data));
  },

  async getById(id: TeamId): Promise<ApiResult<Team>> {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return err(fromSupabaseError(error));
    return ok(cast<Team>(data));
  },

  async create(input: TeamCreate): Promise<ApiResult<Team>> {
    const { data, error } = await supabase
      .from('teams')
      .insert(input)
      .select()
      .single();
    if (error) return err(fromSupabaseError(error));
    return ok(cast<Team>(data));
  },

  async update(id: TeamId, input: TeamUpdate): Promise<ApiResult<Team>> {
    const { data, error } = await supabase
      .from('teams')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return err(fromSupabaseError(error));
    return ok(cast<Team>(data));
  },

  async delete(id: TeamId): Promise<ApiResult<void>> {
    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (error) return err(fromSupabaseError(error));
    return ok(undefined);
  },

  async getMembers(teamId: TeamId): Promise<ApiResult<TeamMember[]>> {
    const { data, error } = await supabase
      .from('team_members')
      .select('*, member:members(*)')
      .eq('team_id', teamId)
      .order('position');
    if (error) return err(fromSupabaseError(error));
    return ok(cast<TeamMember[]>(data));
  },
};
