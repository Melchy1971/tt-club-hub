import { supabase } from '@/integrations/supabase/client';
import { err, ok } from '@/lib/api';
import { fromSupabaseError } from '@/lib/error';
import type { ApiResult, MatchId, TeamId } from '@/types/api';
import type { Match, MatchCreate, MatchUpdate } from '@/types/domain/match';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cast = <T>(v: unknown): T => v as T;

export const matchService = {
  async getAll(): Promise<ApiResult<Match[]>> {
    const { data, error } = await supabase
      .from('matches')
      .select('*, team:teams(id, name, league)')
      .order('date', { ascending: true });
    if (error) return err(fromSupabaseError(error));
    return ok(cast<Match[]>(data));
  },

  async getByTeam(teamId: TeamId): Promise<ApiResult<Match[]>> {
    const { data, error } = await supabase
      .from('matches')
      .select('*, team:teams(id, name, league)')
      .eq('team_id', teamId)
      .order('date', { ascending: true });
    if (error) return err(fromSupabaseError(error));
    return ok(cast<Match[]>(data));
  },

  async getById(id: MatchId): Promise<ApiResult<Match>> {
    const { data, error } = await supabase
      .from('matches')
      .select('*, team:teams(id, name, league)')
      .eq('id', id)
      .single();
    if (error) return err(fromSupabaseError(error));
    return ok(cast<Match>(data));
  },

  async create(input: MatchCreate): Promise<ApiResult<Match>> {
    const { data, error } = await supabase
      .from('matches')
      .insert(input)
      .select()
      .single();
    if (error) return err(fromSupabaseError(error));
    return ok(cast<Match>(data));
  },

  async update(id: MatchId, input: MatchUpdate): Promise<ApiResult<Match>> {
    const { data, error } = await supabase
      .from('matches')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return err(fromSupabaseError(error));
    return ok(cast<Match>(data));
  },

  async delete(id: MatchId): Promise<ApiResult<void>> {
    const { error } = await supabase.from('matches').delete().eq('id', id);
    if (error) return err(fromSupabaseError(error));
    return ok(undefined);
  },
};
