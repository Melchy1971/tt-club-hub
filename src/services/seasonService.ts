import { supabase } from '@/integrations/supabase/client';
import type { Season, SeasonInsert, SeasonUpdate } from '@/types';

export const seasonService = {
  async getAll(): Promise<Season[]> {
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .order('start_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getCurrent(ageGroup?: string): Promise<Season | null> {
    let query = supabase
      .from('seasons')
      .select('*')
      .eq('is_current', true);
    if (ageGroup) {
      query = query.eq('age_group', ageGroup as any);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(season: SeasonInsert): Promise<Season> {
    const { data, error } = await supabase
      .from('seasons')
      .insert(season)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, season: SeasonUpdate): Promise<Season> {
    const { data, error } = await supabase
      .from('seasons')
      .update(season)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('seasons')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async toggleCurrent(id: string, isCurrent: boolean): Promise<Season> {
    const { data, error } = await supabase
      .from('seasons')
      .update({ is_current: isCurrent })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
