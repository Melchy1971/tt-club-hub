import { supabase } from '@/integrations/supabase/client';
import type { Team } from '@/types';
import type { ApiResult, AppError } from '@/types/api';
import type { TeamOverview, TeamWithRoster } from '@/types/domain/team';
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

const resolveSeasonIdByPhaseId = async (seasonPhaseId: string): Promise<string> => {
  const { data, error } = await supabase
    .from('season_phases')
    .select('season_cycle_id')
    .eq('id', seasonPhaseId)
    .maybeSingle();
  if (error) throw fromSupabaseError(error);
  if (!data?.season_cycle_id) {
    throw errors.notFound('Die angegebene Saisonphase wurde nicht gefunden');
  }
  return data.season_cycle_id;
};

// ─── teamService ─────────────────────────────────────────────────────────────

export const teamService = {
  /**
   * Gibt alle Mannschaften zurück, optional gefiltert.
   *
   * Filter-Optionen:
   *   season_cycle_id – nur Mannschaften dieses Saisonzyklus
   *   season_phase_id – nur Mannschaften dieser Saisonphase
   *   is_active   – Aktiv-/Inaktiv-Filter
   *   active_phase – ignoriert season_id/season_phase_id und nimmt stattdessen
   *                  die aktive Phase (season_phases.is_active = true)
   *   active_season – deprecated Fallback auf altes Saisonmodell (seasons.is_current = true)
   */
  async list(filters: TeamFilterInput = {}): Promise<ApiResult<Team[]>> {
    const parsed = teamFilterSchema.safeParse(filters);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message));
    }
    const { is_active, season_cycle_id, season_id, season_phase_id, active_phase, active_season } = parsed.data;

    return tryCatch(async () => {
      if (active_phase) {
        let q = supabase
          .from('teams')
          .select('*, season_phases!inner(id, is_active)')
          .eq('season_phases.is_active', true);
        if (is_active !== undefined) q = q.eq('is_active', is_active);
        const { data, error } = await q.order('name');
        if (error) throw fromSupabaseError(error);
        return (data ?? []).map(({ season_phases: _sp, ...team }) => team as unknown as Team);
      }

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
      const cycleId = season_cycle_id ?? season_id;
      if (cycleId) query = query.eq('season_id', cycleId);
      if (season_phase_id) query = query.eq('season_phase_id', season_phase_id);
      if (is_active !== undefined) query = query.eq('is_active', is_active);
      const { data, error } = await query.order('name');
      if (error) throw fromSupabaseError(error);
      return data ?? [];
    }, toAppError);
  },

  /**
   * Alle aktiven Mannschaften der aktuell aktiven Saisonphase.
   * Kurzform für list({ active_phase: true, is_active: true }).
   */
  async getByActiveSeason(): Promise<ApiResult<Team[]>> {
    return teamService.list({ active_phase: true, is_active: true });
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
      const seasonCycleId = parsed.data.season_cycle_id
        ?? parsed.data.season_id
        ?? await resolveSeasonIdByPhaseId(parsed.data.season_phase_id);
      const { season_cycle_id: _seasonCycleId, ...payload } = parsed.data;
      const { data, error } = await supabase
        .from('teams')
        .insert({
          ...payload,
          season_id: seasonCycleId,
        })
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
      const patch: TeamUpdateInput = { ...parsed.data };
      if (patch.season_phase_id && !patch.season_cycle_id && !patch.season_id) {
        patch.season_id = await resolveSeasonIdByPhaseId(patch.season_phase_id);
      }
      if (patch.season_cycle_id && !patch.season_id) {
        patch.season_id = patch.season_cycle_id;
      }
      const { season_cycle_id: _seasonCycleId, ...dbPatch } = patch;

      const { data, error } = await supabase
        .from('teams')
        .update(dbPatch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw fromSupabaseError(error);
      return data;
    }, toAppError);
  },

  /**
   * Performante Team-Übersicht:
   * - Team-Stammdaten
   * - Kapitän (Name)
   * - Kadergröße (team_members count)
   *
   * Query-Design:
   * 1) Teamliste inkl. captain Join laden
   * 2) Kadergrößen aggregiert in einer zweiten Query laden
   * 3) In-Memory mergen (O(n))
   *
   * Diese Aufteilung vermeidet N+1-Queries pro Team.
   */
  async listOverview(filters: TeamFilterInput = {}): Promise<ApiResult<TeamOverview[]>> {
    const teamsResult = await this.list(filters);
    if (!teamsResult.success) return teamsResult as ApiResult<TeamOverview[]>;

    return tryCatch(async () => {
      const teams = teamsResult.data;
      if (teams.length === 0) return [] as TeamOverview[];
      const teamIds = teams.map((team: Team) => team.id);

      const [{ data: rosterRows, error: rosterError }, { data: captainRows, error: captainError }] = await Promise.all([
        supabase
          .from('team_members')
          .select('team_id')
          .in('team_id', teamIds),
        supabase
          .from('teams')
          .select('id, members:captain_id(id, first_name, last_name)')
          .in('id', teamIds),
      ]);

      if (rosterError) throw fromSupabaseError(rosterError);
      if (captainError) throw fromSupabaseError(captainError);

      const rosterCountByTeam = new Map<string, number>();
      for (const row of rosterRows ?? []) {
        rosterCountByTeam.set(row.team_id, (rosterCountByTeam.get(row.team_id) ?? 0) + 1);
      }

      const captainByTeam = new Map<string, TeamOverview['captain']>();
      for (const row of captainRows ?? []) {
        const memberData = row.members as unknown as TeamOverview['captain'];
        captainByTeam.set(row.id, memberData ?? null);
      }

      return teams.map((team: Team): TeamOverview => ({
        ...(team as any),
        captain: captainByTeam.get(team.id) ?? null,
        roster_size: rosterCountByTeam.get(team.id) ?? 0,
      }));
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
