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
    return ((data ?? []) as SeasonCycleWithPhases[]).map((cycle) => ({
      ...cycle,
      season_phases: [...(cycle.season_phases ?? [])].sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.start_date.localeCompare(b.start_date);
      }),
    }));
  },

  async getActive(): Promise<SeasonCycle | null> {
    const { data, error } = await supabase
      .from('season_cycles')
      .select('*')
      .eq('is_active', true)
      .order('start_year', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getActiveWithPhases(): Promise<SeasonCycleWithPhases | null> {
    const { data, error } = await supabase
      .from('season_cycles')
      .select('*, season_phases(*)')
      .eq('is_active', true)
      .order('start_year', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const cycle = data as SeasonCycleWithPhases;
    return {
      ...cycle,
      season_phases: [...(cycle.season_phases ?? [])].sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.start_date.localeCompare(b.start_date);
      }),
    };
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
  async listByCycle(seasonCycleId: string): Promise<SeasonPhase[]> {
    const { data, error } = await supabase
      .from('season_phases')
      .select('*')
      .eq('season_cycle_id', seasonCycleId)
      .order('sort_order', { ascending: true })
      .order('start_date', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

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
