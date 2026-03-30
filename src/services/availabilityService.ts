/**
 * availabilityService
 *
 * Verwaltet match_player_availability:
 *   – Verfügbarkeit einzelner Spieler pro Spiel setzen / lesen
 *   – Bulk-Initialisierung für den gesamten Kader
 *   – Abfragen für Dashboard und Aufstellungs-Assistent
 *
 * Konflikt-Strategie:
 *   Upsert ON CONFLICT(match_id, member_id) → vermeidet Duplikate ohne vorheriges SELECT.
 *
 * Teamwechsel / Saisonwechsel:
 *   availability-Einträge sind an match_id + member_id gebunden, nicht an team_members.
 *   Wenn ein Spieler das Team wechselt oder eine neue Saison beginnt, bleiben alte
 *   Einträge erhalten (historische Daten). Neue Spiele starten mit status='unknown'.
 *   Beim Initialisieren (initForMatch / initForTeam) wird nur geschrieben wenn noch
 *   kein Eintrag vorhanden ist (skipExisting-Logik).
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { errors, fromSupabaseError, getErrorMessage } from '@/lib/error';
import type { ApiResult, AppError } from '@/types/api';
import {
  availabilitySetSchema,
  availabilityBulkSchema,
  availabilityFilterSchema,
  type AvailabilitySetInput,
  type AvailabilityBulkInput,
  type AvailabilityFilterInput,
  type AvailabilityStatusValue,
} from '@/schemas/availability.schema';

// ─── DB-Typen (bis supabase gen types aktualisiert wird) ─────────────────────

interface AvailabilityRow {
  id: string;
  match_id: string;
  member_id: string;
  team_id: string;
  status: AvailabilityStatusValue;
  note: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── UI-Typ ───────────────────────────────────────────────────────────────────

export interface PlayerAvailabilityUI {
  id: string;
  matchId: string;
  memberId: string;
  teamId: string;
  status: AvailabilityStatusValue;
  note: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields (wenn mit member-Daten abgefragt)
  memberFirstName?: string;
  memberLastName?: string;
  memberFullName?: string;
  memberPosition?: number | null;  // position aus team_members
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

function toUI(row: AvailabilityRow & { members?: { first_name: string; last_name: string } | null }): PlayerAvailabilityUI {
  return {
    id:         row.id,
    matchId:    row.match_id,
    memberId:   row.member_id,
    teamId:     row.team_id,
    status:     row.status,
    note:       row.note,
    updatedBy:  row.updated_by,
    createdAt:  row.created_at,
    updatedAt:  row.updated_at,
    memberFirstName: row.members?.first_name,
    memberLastName:  row.members?.last_name,
    memberFullName:  row.members
      ? `${row.members.first_name} ${row.members.last_name}`.trim()
      : undefined,
  };
}

const toAppError = (e: unknown): AppError => {
  if (e != null && typeof e === 'object' && 'code' in e && 'message' in e) {
    return e as AppError;
  }
  return errors.internal(getErrorMessage(e));
};

// ─── Aggregierter Status für ein Match ───────────────────────────────────────

export interface MatchAvailabilitySummary {
  matchId: string;
  total: number;
  available: number;
  unavailable: number;
  uncertain: number;
  unknown: number;
}

function summarize(matchId: string, entries: PlayerAvailabilityUI[]): MatchAvailabilitySummary {
  return entries.reduce(
    (acc, e) => {
      acc.total++;
      acc[e.status]++;
      return acc;
    },
    { matchId, total: 0, available: 0, unavailable: 0, uncertain: 0, unknown: 0 },
  );
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const availabilityService = {
  // ── Queries ─────────────────────────────────────────────────────────────────

  /**
   * Alle Availability-Einträge für ein Spiel, mit Spieler-Namen.
   * Nutzt idx_availability_match.
   */
  async getForMatch(matchId: string): Promise<ApiResult<PlayerAvailabilityUI[]>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('match_player_availability')
        .select('*, members(first_name, last_name)')
        .eq('match_id', matchId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => toUI(r as AvailabilityRow & { members: { first_name: string; last_name: string } | null }));
    }, fromSupabaseError);
  },

  /**
   * Availability-Verlauf eines Spielers (optional saisonweise).
   * Nutzt idx_availability_member.
   */
  async getForMember(memberId: string, seasonId?: string): Promise<ApiResult<PlayerAvailabilityUI[]>> {
    return tryCatch(async () => {
      let q = supabase
        .from('match_player_availability')
        .select('*')
        .eq('member_id', memberId);

      if (seasonId) {
        // Über schedule_matches.season_id filtern – embedded filter
        const { data: matchIds } = await supabase
          .from('schedule_matches')
          .select('id')
          .eq('season_id', seasonId);
        const ids = (matchIds ?? []).map((m) => m.id);
        if (ids.length === 0) return [];
        q = q.in('match_id', ids);
      }

      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => toUI(r as AvailabilityRow));
    }, fromSupabaseError);
  },

  /**
   * Zusammenfassung: Wie viele Spieler sind für ein Spiel verfügbar?
   */
  async getSummaryForMatch(matchId: string): Promise<ApiResult<MatchAvailabilitySummary>> {
    const result = await availabilityService.getForMatch(matchId);
    if (!result.success) return result;
    return ok(summarize(matchId, result.data));
  },

  /**
   * Generischer Filter für Dashboard-Queries.
   * Nutzt idx_availability_team_status.
   */
  async list(filter: AvailabilityFilterInput = {}): Promise<ApiResult<PlayerAvailabilityUI[]>> {
    const parsed = availabilityFilterSchema.safeParse(filter);
    if (!parsed.success) return err(errors.validation(parsed.error.message));

    return tryCatch(async () => {
      let q = supabase
        .from('match_player_availability')
        .select('*, members(first_name, last_name)');

      if (parsed.data.match_id)  q = q.eq('match_id',  parsed.data.match_id);
      if (parsed.data.team_id)   q = q.eq('team_id',   parsed.data.team_id);
      if (parsed.data.member_id) q = q.eq('member_id', parsed.data.member_id);
      if (parsed.data.status)    q = q.eq('status',    parsed.data.status);

      const { data, error } = await q.order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => toUI(r as AvailabilityRow & { members: { first_name: string; last_name: string } | null }));
    }, fromSupabaseError);
  },

  // ── Mutationen ───────────────────────────────────────────────────────────────

  /**
   * Setzt den Verfügbarkeits-Status eines Spielers für ein Spiel (Upsert).
   * Idempotent: wiederholter Aufruf mit gleichem Status schreibt updated_at.
   */
  async setStatus(input: AvailabilitySetInput): Promise<ApiResult<PlayerAvailabilityUI>> {
    const parsed = availabilitySetSchema.safeParse(input);
    if (!parsed.success) return err(errors.validation(parsed.error.message, parsed.error.issues));

    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('match_player_availability')
        .upsert(parsed.data, { onConflict: 'match_id,member_id' })
        .select('*, members(first_name, last_name)')
        .single();
      if (error) throw error;
      return toUI(data as AvailabilityRow & { members: { first_name: string; last_name: string } | null });
    }, fromSupabaseError);
  },

  /**
   * Bulk-Update: Mehrere Spieler eines Teams für ein Spiel gleichzeitig setzen.
   * Typischer Use-Case: Trainer trägt nach dem Training alle Zusagen ein.
   *
   * Gibt partial-success zurück: { updated[], failed[] }.
   */
  async bulkSetStatus(
    input: AvailabilityBulkInput,
  ): Promise<ApiResult<{ updated: string[]; failed: Array<{ memberId: string; message: string }> }>> {
    const parsed = availabilityBulkSchema.safeParse(input);
    if (!parsed.success) return err(errors.validation(parsed.error.message, parsed.error.issues));

    const { match_id, team_id, entries } = parsed.data;
    const updated: string[] = [];
    const failed: Array<{ memberId: string; message: string }> = [];

    await Promise.allSettled(
      entries.map(async (entry) => {
        const { error } = await supabase
          .from('match_player_availability')
          .upsert(
            { match_id, team_id, member_id: entry.member_id, status: entry.status, note: entry.note ?? null },
            { onConflict: 'match_id,member_id' },
          );
        if (error) failed.push({ memberId: entry.member_id, message: error.message });
        else updated.push(entry.member_id);
      }),
    );

    return ok({ updated, failed });
  },

  /**
   * Initialisiert Verfügbarkeits-Einträge für alle Kader-Spieler eines Spiels.
   * Überspringt Spieler, die bereits einen Eintrag haben (kein Überschreiben).
   *
   * Use-Case: Wenn ein neues Spiel angelegt wird, wird direkt für alle
   * Stammspieler ein 'unknown'-Eintrag erstellt.
   *
   * Edge Cases:
   *  – Saisonwechsel: team_members wurde neu befüllt → alte Einträge bleiben,
   *    neue Spieler bekommen ihren ersten Eintrag.
   *  – Teamwechsel: Spieler ist nicht mehr in team_members → bekommt keinen Eintrag.
   */
  async initForMatch(
    matchId: string,
    teamId: string,
  ): Promise<ApiResult<{ created: number; skipped: number }>> {
    return tryCatch(async () => {
      // 1. Kader für dieses Team laden
      const { data: roster, error: rosterError } = await supabase
        .from('team_members')
        .select('member_id')
        .eq('team_id', teamId);
      if (rosterError) throw rosterError;
      if (!roster || roster.length === 0) return { created: 0, skipped: 0 };

      // 2. Bereits vorhandene Einträge für dieses Spiel laden
      const { data: existing, error: existingError } = await supabase
        .from('match_player_availability')
        .select('member_id')
        .eq('match_id', matchId);
      if (existingError) throw existingError;

      const existingIds = new Set((existing ?? []).map((r) => r.member_id));
      const toCreate = roster
        .filter((r) => !existingIds.has(r.member_id))
        .map((r) => ({
          match_id:  matchId,
          team_id:   teamId,
          member_id: r.member_id,
          status:    'unknown' as const,
        }));

      if (toCreate.length === 0) return { created: 0, skipped: roster.length };

      const { error: insertError } = await supabase
        .from('match_player_availability')
        .insert(toCreate);
      if (insertError) throw insertError;

      return { created: toCreate.length, skipped: existingIds.size };
    }, fromSupabaseError);
  },

  /**
   * Setzt alle Einträge für ein Spiel auf 'unknown' zurück.
   * Use-Case: Spielverlegung – alle Zusagen werden ungültig.
   */
  async resetForMatch(matchId: string): Promise<ApiResult<number>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('match_player_availability')
        .update({ status: 'unknown', note: null })
        .eq('match_id', matchId)
        .select('id');
      if (error) throw error;
      return (data ?? []).length;
    }, fromSupabaseError);
  },

  async remove(matchId: string, memberId: string): Promise<ApiResult<void>> {
    return tryCatch(async () => {
      const { error } = await supabase
        .from('match_player_availability')
        .delete()
        .eq('match_id', matchId)
        .eq('member_id', memberId);
      if (error) throw error;
    }, fromSupabaseError);
  },
};

export { ok } from '@/lib/api';
