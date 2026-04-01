import { supabase } from '@/integrations/supabase/client';
import type {
  SeasonCycle, SeasonCycleInsert, SeasonCycleUpdate,
  SeasonPhase, SeasonPhaseInsert, SeasonPhaseUpdate,
} from '@/types';

export interface SeasonCycleWithPhases extends SeasonCycle {
  season_phases: SeasonPhase[];
}

export const seasonCycleService = {
  async getAll(): Promise<SeasonCycleWithPhases[]> {
    const { data, error } = await supabase
      .from('season_cycles')
      .select('*, season_phases(*)')
      .order('start_year', { ascending: false });
    if (error) throw error;
    return (data ?? []) as SeasonCycleWithPhases[];
  },

  async create(cycle: SeasonCycleInsert): Promise<SeasonCycle> {
    const { data, error } = await supabase
      .from('season_cycles')
      .insert(cycle)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, cycle: SeasonCycleUpdate): Promise<SeasonCycle> {
    const { data, error } = await supabase
      .from('season_cycles')
      .update(cycle)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('season_cycles').delete().eq('id', id);
    if (error) throw error;
  },

  async toggleActive(id: string, isActive: boolean): Promise<SeasonCycle> {
    const { data, error } = await supabase
      .from('season_cycles')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

export const seasonPhaseService = {
  async create(phase: SeasonPhaseInsert): Promise<SeasonPhase> {
    const { data, error } = await supabase
      .from('season_phases')
      .insert(phase)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, phase: SeasonPhaseUpdate): Promise<SeasonPhase> {
    const { data, error } = await supabase
      .from('season_phases')
      .update(phase)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('season_phases').delete().eq('id', id);
    if (error) throw error;
  },

  async toggleActive(id: string, isActive: boolean): Promise<SeasonPhase> {
    const { data, error } = await supabase
      .from('season_phases')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getActive(): Promise<SeasonPhase | null> {
    const { data, error } = await supabase
      .from('season_phases')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};
