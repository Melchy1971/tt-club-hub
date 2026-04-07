/**
 * substituteService
 *
 * Verwaltet Ersatzanfragen (substitute_requests).
 *
 * Statusworkflow:
 *   pending ──► accepted ──► cancelled (terminal)
 *           └──► rejected  (terminal)
 *           └──► cancelled (terminal)
 *
 * Konflikt-Prävention (client-seitig, da keine DB-Unique-Constraints):
 *   1. Spieler bereits für dasselbe Spiel angefragt (pending/accepted)
 *   2. Ersatzspieler nicht aktiv (is_active = false)
 *   3. Anfrage für falsche season_phase (match.season_phase_id ≠ team.season_phase_id)
 *   4. Ungültiger Statusübergang
 *
 * DB-Hinweis: 'cancelled' erfordert eine Migration:
 *   ALTER TYPE substitute_status ADD VALUE 'cancelled';
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { errors, fromSupabaseError } from '@/lib/error';
import type { ApiResult } from '@/types/api';
import type { SubstituteRequest, SubstituteRequestUI } from '@/types/domain/substitute';
import {
  substituteRequestCreateSchema,
  substituteRequestResolveSchema,
  substituteRequestFilterSchema,
  isValidTransition,
  isTerminal,
  type SubstituteRequestCreateInput,
  type SubstituteRequestResolveInput,
  type SubstituteRequestFilterInput,
} from '@/schemas/substitute.schema';

// ─── Select-String ─────────────────────────────────────────────────────────────
// Joins: match-Daten + beide Mitglieder (mehrere FKs zur gleichen Tabelle).

const SELECT_WITH_RELATIONS = `
  *,
  match:schedule_matches(match_date, home_team, away_team, season_phase_id),
  requesting_member:members!requesting_member_id(first_name, last_name),
  substitute_member:members!substitute_member_id(first_name, last_name)
`.trim();

// ─── Mapping ───────────────────────────────────────────────────────────────────

function toUI(row: any): SubstituteRequestUI {
  const { match, requesting_member, substitute_member, ...core } = row;
  return {
    ...core,
    season_phase_id: match?.season_phase_id ?? null,
    match: match ?? null,
    requesting_member: requesting_member ?? null,
    substitute_member: substitute_member ?? null,
  } as SubstituteRequestUI;
}

// ─── Interner Hilfsdienst: Match-IDs für season_phase / Datumsbereich ──────────
//
// substitute_requests hat keine season_phase_id-Spalte. Wenn nach season_phase_id,
// from_date oder to_date gefiltert wird, lösen wir zuerst die passenden match_ids auf.

async function resolveMatchIds(
  seasonPhaseId?: string,
  fromDate?: string,
  toDate?: string,
): Promise<string[] | null> {
  if (!seasonPhaseId && !fromDate && !toDate) return null;

  let q = supabase.from('schedule_matches').select('id');
  if (seasonPhaseId) q = q.eq('season_phase_id', seasonPhaseId);
  if (fromDate)      q = q.gte('match_date', fromDate);
  if (toDate)        q = q.lte('match_date', toDate);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: { id: string }) => r.id);
}

// ─── Service ───────────────────────────────────────────────────────────────────

export const substituteService = {

  // ── Queries ──────────────────────────────────────────────────────────────────

  /**
   * Listet Ersatzanfragen mit optionalem Filter.
   *
   * season_phase_id, from_date und to_date filtern indirekt über schedule_matches.
   * open_only ist Kurzform für status = 'pending'.
   */
  async list(filter: SubstituteRequestFilterInput = {}): Promise<ApiResult<SubstituteRequestUI[]>> {
    const parsed = substituteRequestFilterSchema.safeParse(filter);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.issues));
    }

    const {
      match_id,
      team_id,
      requesting_member_id,
      substitute_member_id,
      status,
      season_phase_id,
      open_only,
      from_date,
      to_date,
    } = parsed.data;

    return tryCatch(async () => {
      // Wenn nach season_phase / Datum gefiltert: match_ids vorab auflösen
      const matchIds = await resolveMatchIds(season_phase_id, from_date, to_date);
      // Leeres Ergebnis-Set: kein passender Match existiert
      if (matchIds !== null && matchIds.length === 0) return [];

      let q = supabase
        .from('substitute_requests')
        .select(SELECT_WITH_RELATIONS)
        .order('created_at', { ascending: false });

      if (match_id)             q = q.eq('match_id', match_id);
      if (team_id)              q = q.eq('team_id', team_id);
      if (requesting_member_id) q = q.eq('requesting_member_id', requesting_member_id);
      if (substitute_member_id) q = q.eq('substitute_member_id', substitute_member_id);
      if (open_only)            q = q.eq('status', 'pending');
      else if (status)          q = q.eq('status', status as any);
      if (matchIds !== null)    q = q.in('match_id', matchIds);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(toUI);
    }, fromSupabaseError);
  },

  /** Einzelne Anfrage mit verknüpften Entitäten. */
  async getById(id: string): Promise<ApiResult<SubstituteRequestUI>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('substitute_requests')
        .select(SELECT_WITH_RELATIONS)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw { message: `Ersatzanfrage "${id}" nicht gefunden`, code: 'PGRST116' };
      return toUI(data);
    }, fromSupabaseError);
  },

  /** Alle (offenen) Anfragen für ein bestimmtes Spiel. */
  async listForMatch(matchId: string, openOnly = false): Promise<ApiResult<SubstituteRequestUI[]>> {
    return this.list({ match_id: matchId, ...(openOnly ? { open_only: true } : {}) });
  },

  /** Alle Anfragen, bei denen ein Mitglied als Ersatzspieler angefragt wurde. */
  async listForSubstitute(memberId: string): Promise<ApiResult<SubstituteRequestUI[]>> {
    return this.list({ substitute_member_id: memberId });
  },

  /** Alle Anfragen, die ein Mitglied selbst gestellt hat. */
  async listByRequester(memberId: string): Promise<ApiResult<SubstituteRequestUI[]>> {
    return this.list({ requesting_member_id: memberId });
  },

  // ── Mutations ─────────────────────────────────────────────────────────────────

  /**
   * Erstellt eine neue Ersatzanfrage.
   *
   * Validierungsreihenfolge:
   *   1. Schema-Validierung (Zod)
   *   2. Spiel existiert? → match_id
   *   3. Team gehört zum selben Spiel? → match.team_id === team_id
   *   4. Spiel in der richtigen season_phase? → match.season_phase_id === team.season_phase_id
   *   5. Ersatzspieler aktiv? → members.is_active
   *   6. Doppel-Anfrage? → pending/accepted für (match_id, substitute_member_id)
   */
  async create(
    input: SubstituteRequestCreateInput,
    createdBy: string,
  ): Promise<ApiResult<SubstituteRequestUI>> {
    const parsed = substituteRequestCreateSchema.safeParse(input);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.issues));
    }
    const { match_id, team_id, requesting_member_id, substitute_member_id, note } = parsed.data;

    return tryCatch(async () => {
      // ── 1. Spiel laden ────────────────────────────────────────────────────────
      const { data: match, error: matchErr } = await supabase
        .from('schedule_matches')
        .select('id, team_id, season_phase_id, status')
        .eq('id', match_id)
        .maybeSingle();
      if (matchErr) throw matchErr;
      if (!match) throw errors.notFound('Spiel', match_id);

      // ── 2. Team des Spiels muss mit der Anfrage übereinstimmen ───────────────
      if (match.team_id !== team_id) {
        throw errors.validation(
          `Das Spiel gehört zur Mannschaft "${match.team_id}", nicht zu "${team_id}"`,
        );
      }

      // ── 3. season_phase-Konsistenz: Team muss in derselben Phase wie das Spiel ─
      if (match.season_phase_id) {
        const { data: team, error: teamErr } = await supabase
          .from('teams')
          .select('id, season_phase_id')
          .eq('id', team_id)
          .maybeSingle();
        if (teamErr) throw teamErr;
        if (!team) throw errors.notFound('Mannschaft', team_id);

        if (team.season_phase_id && team.season_phase_id !== match.season_phase_id) {
          throw errors.validation(
            `Spiel gehört zu season_phase "${match.season_phase_id}", ` +
            `Mannschaft aber zu "${team.season_phase_id}" – falsche Saisonphase`,
          );
        }
      }

      // ── 4. Spielberechtigung: Ersatzspieler muss aktiv sein ──────────────────
      const { data: member, error: memberErr } = await supabase
        .from('members')
        .select('id, is_active, first_name, last_name')
        .eq('id', substitute_member_id)
        .maybeSingle();
      if (memberErr) throw memberErr;
      if (!member) throw errors.notFound('Mitglied', substitute_member_id);
      if (!member.is_active) {
        throw errors.conflict(
          `${member.first_name} ${member.last_name} ist kein aktives Mitglied und nicht spielberechtigt`,
        );
      }

      // ── 5. Doppel-Anfrage verhindern ──────────────────────────────────────────
      const { data: duplicate, error: dupErr } = await supabase
        .from('substitute_requests')
        .select('id, status')
        .eq('match_id', match_id)
        .eq('substitute_member_id', substitute_member_id)
        .in('status', ['pending', 'accepted'])
        .maybeSingle();
      if (dupErr) throw dupErr;
      if (duplicate) {
        const label = duplicate.status === 'accepted' ? 'bereits bestätigt' : 'bereits offen';
        throw errors.conflict(
          `Für dieses Spiel ist eine Anfrage an diesen Spieler ${label} (ID: ${duplicate.id})`,
        );
      }

      // ── 6. Einfügen ───────────────────────────────────────────────────────────
      const { data: inserted, error: insertErr } = await supabase
        .from('substitute_requests')
        .insert({
          match_id,
          team_id,
          requesting_member_id,
          substitute_member_id,
          note: note ?? null,
          created_by: createdBy,
          // status defaultet auf 'pending' (DB-Default)
        })
        .select(SELECT_WITH_RELATIONS)
        .single();
      if (insertErr) throw insertErr;
      return toUI(inserted);
    }, fromSupabaseError);
  },

  /**
   * Ändert den Status einer Anfrage (accept / reject / cancel).
   *
   * Validiert den Übergang gegen VALID_TRANSITIONS bevor ein DB-Write erfolgt.
   */
  async resolve(
    id: string,
    input: SubstituteRequestResolveInput,
    resolvedBy: string,
  ): Promise<ApiResult<SubstituteRequestUI>> {
    const parsed = substituteRequestResolveSchema.safeParse(input);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.issues));
    }
    const newStatus = parsed.data.status;

    return tryCatch(async () => {
      // Aktuellen Status laden
      const { data: existing, error: fetchErr } = await supabase
        .from('substitute_requests')
        .select('id, status')
        .eq('id', id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!existing) throw errors.notFound('Ersatzanfrage', id);

      const currentStatus = existing.status as SubstituteRequest['status'];

      // Übergang validieren
      if (isTerminal(currentStatus)) {
        throw errors.conflict(
          `Anfrage ist bereits in terminalem Status "${currentStatus}" und kann nicht mehr geändert werden`,
        );
      }
      if (!isValidTransition(currentStatus, newStatus)) {
        throw errors.conflict(
          `Statusübergang "${currentStatus}" → "${newStatus}" ist nicht erlaubt`,
        );
      }

      const { data: updated, error: updateErr } = await supabase
        .from('substitute_requests')
        .update({
          status: newStatus as any, // 'cancelled' erfordert DB-Migration
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select(SELECT_WITH_RELATIONS)
        .single();
      if (updateErr) throw updateErr;
      return toUI(updated);
    }, fromSupabaseError);
  },

  /** Anfrage annehmen. */
  async accept(id: string, resolvedBy: string): Promise<ApiResult<SubstituteRequestUI>> {
    return this.resolve(id, { status: 'accepted' }, resolvedBy);
  },

  /** Anfrage ablehnen. */
  async reject(id: string, resolvedBy: string): Promise<ApiResult<SubstituteRequestUI>> {
    return this.resolve(id, { status: 'rejected' }, resolvedBy);
  },

  /** Anfrage stornieren (pending oder accepted). */
  async cancel(id: string, cancelledBy: string): Promise<ApiResult<SubstituteRequestUI>> {
    return this.resolve(id, { status: 'cancelled' }, cancelledBy);
  },

  // ── Statistik-Abfrage ─────────────────────────────────────────────────────────

  /**
   * Schnellübersicht für ein Team oder eine Saisonphase:
   * Anzahl nach Status gruppiert.
   */
  async countByStatus(filter: {
    team_id?: string;
    season_phase_id?: string;
  }): Promise<ApiResult<Record<SubstituteRequest['status'], number>>> {
    return tryCatch(async () => {
      const matchIds = filter.season_phase_id
        ? await resolveMatchIds(filter.season_phase_id)
        : null;
      if (matchIds !== null && matchIds.length === 0) {
        return { pending: 0, accepted: 0, rejected: 0, cancelled: 0 };
      }

      let q = supabase
        .from('substitute_requests')
        .select('status');
      if (filter.team_id) q = q.eq('team_id', filter.team_id);
      if (matchIds)       q = q.in('match_id', matchIds);

      const { data, error } = await q;
      if (error) throw error;

      const counts: Record<string, number> = { pending: 0, accepted: 0, rejected: 0, cancelled: 0 };
      for (const row of data ?? []) {
        const s = row.status as string;
        counts[s] = (counts[s] ?? 0) + 1;
      }
      return counts as Record<SubstituteRequest['status'], number>;
    }, fromSupabaseError);
  },
};
