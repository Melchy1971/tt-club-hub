import { supabase } from '@/integrations/supabase/client';
import type { Season, SeasonInsert } from '@/types';

export const seasonService = {
  async getAll(): Promise<Season[]> {
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .order('start_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getCurrent(): Promise<Season | null> {
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('is_current', true)
      .maybeSingle();
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
};
