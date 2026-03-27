import { supabase } from '@/integrations/supabase/client';
import type { Team } from '@/types';
import type { ApiResult, AppError } from '@/types/api';
import type { TeamWithRoster } from '@/types/domain/team';
import { ok, err, tryCatch } from '@/lib/api';
import { errors, fromSupabaseError, getErrorMessage } from '@/lib/error';
import {
  teamCreateSchema,
  teamUpdateSchema,
  teamFilterSchema,
} from '@/schemas/team.schema';
import type {
  TeamCreateInput,
  TeamUpdateInput,
  TeamFilterInput,
} from '@/schemas/team.schema';

// ─── Interner Fehler-Mapper ───────────────────────────────────────────────────
// Wandelt einen gefangenen Wert in AppError um.
// fromSupabaseError gibt bereits ein AppError-Objekt zurück; das erkennen wir
// anhand des 'code'-Felds, um den Typ nicht erneut zu wrappen.
const toAppError = (e: unknown): AppError => {
  if (e != null && typeof e === 'object' && 'code' in e && 'message' in e) {
    return e as AppError;
  }
  return errors.internal(getErrorMessage(e));
};

// ─── teamService ─────────────────────────────────────────────────────────────

export const teamService = {
  /**
   * Gibt alle Mannschaften zurück, optional gefiltert.
   *
   * Filter-Optionen:
   *   season_id   – nur Mannschaften dieser Saison
   *   is_active   – Aktiv-/Inaktiv-Filter
   *   active_season – ignoriert season_id und nimmt stattdessen die aktuelle Saison
   *                   (seasons.is_current = true); nutzt den idx_teams_season_active-Index.
   */
  async list(filters: TeamFilterInput = {}): Promise<ApiResult<Team[]>> {
    const parsed = teamFilterSchema.safeParse(filters);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message));
    }
    const { is_active, season_id, active_season } = parsed.data;

    return tryCatch(async () => {
      if (active_season) {
        // JOIN auf seasons, damit kein zweiter Round-Trip nötig ist.
        // idx_teams_season_active_only (partial WHERE is_active=true) wird genutzt,
        // wenn is_active === true oder undefiniert.
        let q = supabase
          .from('teams')
          .select('*, seasons!inner(id, is_current)')
          .eq('seasons.is_current', true);
        if (is_active !== undefined) q = q.eq('is_active', is_active);
        const { data, error } = await q.order('name');
        if (error) throw fromSupabaseError(error);
        // Seasons-Daten aus der Response herausfiltern – wir wollen nur Team-Felder.
        return (data ?? []).map(({ seasons: _s, ...team }) => team as unknown as Team);
      }

      let query = supabase.from('teams').select('*');
      if (season_id) query = query.eq('season_id', season_id);
      if (is_active !== undefined) query = query.eq('is_active', is_active);
      const { data, error } = await query.order('name');
      if (error) throw fromSupabaseError(error);
      return data ?? [];
    }, toAppError);
  },

  /**
   * Alle aktiven Mannschaften der aktuell gesetzten Saison (is_current = true).
   * Kurzform für list({ active_season: true, is_active: true }).
   * Nutzt idx_teams_season_active_only.
   */
  async getByActiveSeason(): Promise<ApiResult<Team[]>> {
    return teamService.list({ active_season: true, is_active: true });
  },

  async getById(id: string): Promise<ApiResult<Team | null>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw fromSupabaseError(error);
      return data;
    }, toAppError);
  },

  /**
   * Team mit vollständigem Kader in einem einzigen Query.
   * Der Kader ist aufsteigend nach Position sortiert.
   * Nutzt den UNIQUE(team_id, position)-Index für das ORDER BY.
   */
  async getWithRoster(id: string): Promise<ApiResult<TeamWithRoster | null>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*, team_members(*, members(*))')
        .eq('id', id)
        .order('position', { referencedTable: 'team_members', ascending: true })
        .maybeSingle();
      if (error) throw fromSupabaseError(error);
      return data as TeamWithRoster | null;
    }, toAppError);
  },

  async create(input: TeamCreateInput): Promise<ApiResult<Team>> {
    const parsed = teamCreateSchema.safeParse(input);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.flatten()));
    }
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('teams')
        .insert(parsed.data)
        .select()
        .single();
      if (error) throw fromSupabaseError(error);
      return data;
    }, toAppError);
  },

  async update(id: string, input: TeamUpdateInput): Promise<ApiResult<Team>> {
    const parsed = teamUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.flatten()));
    }
    if (Object.keys(parsed.data).length === 0) {
      return err(errors.validation('Keine Felder zum Aktualisieren angegeben'));
    }
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('teams')
        .update(parsed.data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw fromSupabaseError(error);
      return data;
    }, toAppError);
  },

  /**
   * Löscht eine Mannschaft.
   * RESTRICT-FK auf seasons verhindert das Löschen einer Saison,
   * solange noch Teams existieren – das ist DB-seitig abgesichert.
   * CASCADE auf team_members löscht automatisch alle Zuordnungen.
   */
  async remove(id: string): Promise<ApiResult<void>> {
    return tryCatch(async () => {
      const { error } = await supabase.from('teams').delete().eq('id', id);
      if (error) throw fromSupabaseError(error);
    }, toAppError);
  },
};
