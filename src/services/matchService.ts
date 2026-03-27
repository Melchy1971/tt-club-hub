import { supabase } from '@/integrations/supabase/client';
import type { ScheduleMatch, ScheduleMatchInsert, ScheduleMatchUpdate } from '@/types';

/** Venue-Daten die via JOIN geladen werden. */
export interface VenueSummary {
  name: string;
  street: string | null;
  city: string | null;
  zip_code: string | null;
}

/** ScheduleMatch mit optionalem Venue-Join. */
export type ScheduleMatchFull = ScheduleMatch & {
  venues: VenueSummary | null;
};

/** Formatiert eine Venue-Adresse für die Anzeige. */
export function formatVenueAddress(venue: VenueSummary | null | undefined): string {
  if (!venue) return '';
  const parts: string[] = [venue.name];
  const address = [venue.street, [venue.zip_code, venue.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  if (address) parts.push(address);
  return parts.join(' · ');
}

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

  /**
   * Team-Spielplan mit gejointen Venue-Daten.
   * Nutzt idx_schedule_matches_season_team_date für den Lookup.
   */
  async getByTeamWithVenue(teamId: string): Promise<ScheduleMatchFull[]> {
    const { data, error } = await supabase
      .from('schedule_matches')
      .select('*, venues(name, street, city, zip_code)')
      .eq('team_id', teamId)
      .order('match_date', { ascending: true })
      .order('match_time', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (data ?? []) as unknown as ScheduleMatchFull[];
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

  /**
   * Alle Spiele einer Saison mit Team-Grunddaten (für Übersichtsseite).
   * Gibt Match-Count pro Team ermöglichend zurück.
   */
  async getBySeasonWithTeam(
    seasonId: string,
  ): Promise<(ScheduleMatch & { teams: { name: string } | null })[]> {
    const { data, error } = await supabase
      .from('schedule_matches')
      .select('*, teams(name)')
      .eq('season_id', seasonId)
      .order('match_date', { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as (ScheduleMatch & { teams: { name: string } | null })[];
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
