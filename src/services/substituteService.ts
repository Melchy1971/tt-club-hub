/**
 * substituteService
 *
 * Verwaltet substitute_requests – Anfragen für Ersatzspieler pro Spiel.
 *
 * Status-Workflow (gespiegelt aus DB-Trigger):
 *
 *   pending ──► accepted   (Trainer/Vorstand/Admin genehmigt)
 *           ──► declined   (Trainer/Vorstand/Admin lehnt ab)
 *           ──► cancelled  (Anfragesteller oder Trainer zieht zurück)
 *   accepted ──► cancelled (nur Trainer/Admin, z.B. bei Spielverlegung)
 *
 * Berechtigungs-Checks erfolgen service-seitig VOR dem DB-Call:
 *   – request()  → substitute:write  (spieler, trainer, …)
 *   – approve()  → substitute:approve (trainer, vorstand, admin)
 *   – decline()  → substitute:approve
 *   – cancel()   → substitute:write + Eigentumscheck ODER substitute:approve
 *
 * Konflikt-Prüfung (service-seitig, redundant zu DB-Trigger):
 *   – Spieler bereits pending/accepted für dasselbe Spiel → CONFLICT
 *   – Spieler ist Stammspieler des anfragenden Teams → CONFLICT
 *   – Team und Spiel in unterschiedlicher Saison → VALIDATION_ERROR
 *   – Spiel liegt in der Vergangenheit → VALIDATION_ERROR (soft – nur Warnung)
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { errors, fromSupabaseError, getErrorMessage } from '@/lib/error';
import { hasPermission } from '@/lib/permissions';
import { todayISO } from '@/lib/date';
import type { ApiResult, AppError } from '@/types/api';
import type { AppRole } from '@/types/auth';
import {
  substituteRequestCreateSchema,
  substituteRequestResolveSchema,
  substituteRequestFilterSchema,
  isValidTransition,
  isTerminal,
  type SubstituteRequestCreateInput,
  type SubstituteRequestResolveInput,
  type SubstituteRequestFilterInput,
  type SubstituteRequestStatus,
} from '@/schemas/substitute.schema';

// ─── DB-Typ ───────────────────────────────────────────────────────────────────

interface SubstituteRequestRow {
  id: string;
  match_id: string;
  requesting_team_id: string;
  substitute_member_id: string;
  status: SubstituteRequestStatus;
  requested_by: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  note: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

// ─── UI-Typ ───────────────────────────────────────────────────────────────────

export interface SubstituteRequestUI {
  id: string;
  matchId: string;
  requestingTeamId: string;
  substituteMemberId: string;
  status: SubstituteRequestStatus;
  requestedBy: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  note: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  matchDate?: string;
  matchDay?: number | null;
  homeTeam?: string;
  awayTeam?: string;
  teamName?: string;
  memberFirstName?: string;
  memberLastName?: string;
  memberFullName?: string;
  memberTtr?: number | null;
  /** true wenn Spieldatum in der Vergangenheit liegt */
  isPast?: boolean;
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

type JoinedRow = SubstituteRequestRow & {
  schedule_matches?: {
    match_date: string;
    match_day: number | null;
    home_team: string;
    away_team: string;
  } | null;
  teams?: { name: string } | null;
  members?: {
    first_name: string;
    last_name: string;
    ttr_rating: number | null;
  } | null;
};

function toUI(row: JoinedRow): SubstituteRequestUI {
  const matchDate = row.schedule_matches?.match_date;
  return {
    id:                  row.id,
    matchId:             row.match_id,
    requestingTeamId:    row.requesting_team_id,
    substituteMemberId:  row.substitute_member_id,
    status:              row.status,
    requestedBy:         row.requested_by,
    resolvedBy:          row.resolved_by,
    resolvedAt:          row.resolved_at,
    note:                row.note,
    resolutionNote:      row.resolution_note,
    createdAt:           row.created_at,
    updatedAt:           row.updated_at,
    matchDate,
    matchDay:            row.schedule_matches?.match_day,
    homeTeam:            row.schedule_matches?.home_team,
    awayTeam:            row.schedule_matches?.away_team,
    teamName:            row.teams?.name,
    memberFirstName:     row.members?.first_name,
    memberLastName:      row.members?.last_name,
    memberFullName:      row.members
      ? `${row.members.first_name} ${row.members.last_name}`.trim()
      : undefined,
    memberTtr:           row.members?.ttr_rating,
    isPast:              matchDate ? matchDate < todayISO() : undefined,
  };
}

const toAppError = (e: unknown): AppError => {
  if (e != null && typeof e === 'object' && 'code' in e && 'message' in e) {
    return e as AppError;
  }
  return errors.internal(getErrorMessage(e));
};

// ─── Interne Validierungshilfen ───────────────────────────────────────────────

/**
 * Prüft service-seitig auf Konflikte BEVOR der DB-Call erfolgt.
 * Gibt null zurück wenn alles OK, sonst einen AppError.
 *
 * Redundant zu DB-Triggern – verhindert unnötige Round-Trips und
 * liefert bessere Fehlermeldungen als PostgreSQL-Exceptions.
 */
async function checkCreateConflicts(
  input: SubstituteRequestCreateInput,
): Promise<AppError | null> {
  // 1. Saison-Konsistenz: Spiel und Team müssen in derselben Saison sein
  const [matchResult, teamResult] = await Promise.all([
    supabase
      .from('schedule_matches')
      .select('season_id, match_date, status')
      .eq('id', input.match_id)
      .maybeSingle(),
    supabase
      .from('teams')
      .select('season_id, name')
      .eq('id', input.requesting_team_id)
      .maybeSingle(),
  ]);

  if (!matchResult.data) return errors.notFound('Spiel', input.match_id);
  if (!teamResult.data) return errors.notFound('Mannschaft', input.requesting_team_id);

  if (matchResult.data.season_id !== teamResult.data.season_id) {
    return errors.validation(
      `Mannschaft "${teamResult.data.name}" gehört nicht zur Saison des Spiels`,
    );
  }

  // 2. Spiel darf nicht abgesagt/beendet sein
  if (matchResult.data.status === 'abgesagt') {
    return errors.validation('Für ein abgesagtes Spiel können keine Ersatz-Anfragen gestellt werden');
  }

  // 3. Spieler ist bereits Stammspieler des anfragenden Teams
  const rosterCheck = await supabase
    .from('team_members')
    .select('member_id')
    .eq('team_id', input.requesting_team_id)
    .eq('member_id', input.substitute_member_id)
    .maybeSingle();

  if (rosterCheck.data) {
    return errors.conflict(
      'Der Spieler ist bereits im Kader der anfragenden Mannschaft',
    );
  }

  // 4. Bereits eine offene (pending/accepted) Anfrage für denselben Spieler+Spiel?
  const existingCheck = await supabase
    .from('substitute_requests')
    .select('id, status')
    .eq('match_id', input.match_id)
    .eq('substitute_member_id', input.substitute_member_id)
    .in('status', ['pending', 'accepted'])
    .maybeSingle();

  if (existingCheck.data) {
    const statusLabel = existingCheck.data.status === 'pending' ? 'offen' : 'bestätigt';
    return errors.conflict(
      `Für diesen Spieler existiert bereits eine ${statusLabel} Anfrage für dieses Spiel`,
    );
  }

  return null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const substituteService = {
  // ── Queries ──────────────────────────────────────────────────────────────────

  /**
   * Alle Anfragen mit optionalem Filter.
   * Joined: Spieldaten, Teamname, Spieler-Name + TTR.
   *
   * Nutzt idx_substitute_match_status / idx_substitute_team_status.
   */
  async list(filter: SubstituteRequestFilterInput = {}): Promise<ApiResult<SubstituteRequestUI[]>> {
    const parsed = substituteRequestFilterSchema.safeParse(filter);
    if (!parsed.success) return err(errors.validation(parsed.error.message));

    return tryCatch(async () => {
      const {
        match_id, requesting_team_id, substitute_member_id,
        status, season_id, open_only, from_date, to_date,
      } = parsed.data;

      let q = supabase
        .from('substitute_requests')
        .select(`
          *,
          schedule_matches(match_date, match_day, home_team, away_team),
          teams(name),
          members!substitute_member_id(first_name, last_name, ttr_rating)
        `);

      if (match_id)             q = q.eq('match_id', match_id);
      if (requesting_team_id)   q = q.eq('requesting_team_id', requesting_team_id);
      if (substitute_member_id) q = q.eq('substitute_member_id', substitute_member_id);
      if (status)               q = q.eq('status', status);
      if (open_only)            q = q.eq('status', 'pending');

      // Saison-Filter über schedule_matches.season_id
      if (season_id) {
        const { data: matchIds } = await supabase
          .from('schedule_matches')
          .select('id')
          .eq('season_id', season_id);
        const ids = (matchIds ?? []).map((m) => m.id);
        if (ids.length === 0) return [];
        q = q.in('match_id', ids);
      }

      // Datum-Filter über schedule_matches.match_date (denormalisiert via join)
      if (from_date || to_date) {
        const { data: matchIds } = await supabase
          .from('schedule_matches')
          .select('id')
          .gte('match_date', from_date ?? '1900-01-01')
          .lte('match_date', to_date ?? '9999-12-31');
        const ids = (matchIds ?? []).map((m) => m.id);
        if (ids.length === 0) return [];
        q = q.in('match_id', ids);
      }

      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => toUI(r as JoinedRow));
    }, toAppError);
  },

  /**
   * Einzelne Anfrage mit allen Joins.
   */
  async getById(id: string): Promise<ApiResult<SubstituteRequestUI>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('substitute_requests')
        .select(`
          *,
          schedule_matches(match_date, match_day, home_team, away_team),
          teams(name),
          members!substitute_member_id(first_name, last_name, ttr_rating)
        `)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw { message: `Anfrage "${id}" nicht gefunden`, code: 'PGRST116' };
      return toUI(data as JoinedRow);
    }, toAppError);
  },

  /**
   * Alle offenen Anfragen (pending) – globale Admin-Übersicht.
   * Nutzt den Partial-Index idx_substitute_pending.
   */
  async listPending(): Promise<ApiResult<SubstituteRequestUI[]>> {
    return substituteService.list({ open_only: true });
  },

  /**
   * Alle Anfragen für einen Spieler (sein Dashboard).
   * Nutzt idx_substitute_member.
   */
  async listForMember(memberId: string): Promise<ApiResult<SubstituteRequestUI[]>> {
    return substituteService.list({ substitute_member_id: memberId });
  },

  // ── Mutationen ───────────────────────────────────────────────────────────────

  /**
   * Neue Ersatz-Anfrage stellen.
   *
   * Berechtigung: substitute:write
   * Konflikte werden service-seitig geprüft (vor DB-Call).
   *
   * @param input         Anfrage-Daten
   * @param actorRole     Rolle des anfragenden Nutzers (für Permission-Check)
   * @param actorUserId   auth.uid() des anfragenden Nutzers
   */
  async request(
    input: SubstituteRequestCreateInput,
    actorRole: AppRole,
    actorUserId: string,
  ): Promise<ApiResult<SubstituteRequestUI>> {
    if (!hasPermission(actorRole, 'substitute:write')) {
      return err(errors.forbidden('Ersatz-Anfrage stellen'));
    }

    const parsed = substituteRequestCreateSchema.safeParse(input);
    if (!parsed.success) return err(errors.validation(parsed.error.message, parsed.error.issues));

    const conflict = await checkCreateConflicts(parsed.data);
    if (conflict) return err(conflict);

    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('substitute_requests')
        .insert({ ...parsed.data, requested_by: actorUserId })
        .select(`
          *,
          schedule_matches(match_date, match_day, home_team, away_team),
          teams(name),
          members!substitute_member_id(first_name, last_name, ttr_rating)
        `)
        .single();
      if (error) throw error;
      return toUI(data as JoinedRow);
    }, (e) => {
      // Postgres-Exception aus Trigger → lesbare Fehlermeldung
      const msg = getErrorMessage(e);
      if (msg.includes('Saison')) return errors.validation(msg);
      if (msg.includes('Kader'))  return errors.conflict(msg);
      return fromSupabaseError(e as { message: string; code?: string });
    });
  },

  /**
   * Status einer Anfrage setzen (accept / decline / cancel).
   *
   * Berechtigungs-Matrix:
   *   pending → accepted:   substitute:approve
   *   pending → declined:   substitute:approve
   *   pending → cancelled:  substitute:write + Eigentumscheck ODER substitute:approve
   *   accepted → cancelled: substitute:approve
   *
   * @param id          ID der Anfrage
   * @param input       Neuer Status + optionale resolution_note
   * @param actorRole   Rolle des handelnden Nutzers
   * @param actorUserId auth.uid() des handelnden Nutzers
   */
  async resolve(
    id: string,
    input: SubstituteRequestResolveInput,
    actorRole: AppRole,
    actorUserId: string,
  ): Promise<ApiResult<SubstituteRequestUI>> {
    const parsed = substituteRequestResolveSchema.safeParse(input);
    if (!parsed.success) return err(errors.validation(parsed.error.message, parsed.error.issues));

    // Aktuelle Anfrage laden
    const current = await substituteService.getById(id);
    if (!current.success) return current;

    const req = current.data;

    // Terminale Status → kein Übergang möglich
    if (isTerminal(req.status)) {
      return err(errors.validation(`Anfrage ist bereits "${req.status}" und kann nicht mehr geändert werden`));
    }

    // Übergang erlaubt?
    if (!isValidTransition(req.status, parsed.data.status)) {
      return err(errors.validation(
        `Übergang von "${req.status}" nach "${parsed.data.status}" ist nicht erlaubt`,
      ));
    }

    // Berechtigungs-Check je Ziel-Status
    const targetStatus = parsed.data.status;

    if (targetStatus === 'accepted' || targetStatus === 'declined') {
      if (!hasPermission(actorRole, 'substitute:approve')) {
        return err(errors.forbidden(`Ersatz-Anfrage ${targetStatus === 'accepted' ? 'genehmigen' : 'ablehnen'}`));
      }
    }

    if (targetStatus === 'cancelled') {
      const canApprove = hasPermission(actorRole, 'substitute:approve');
      const isOwner    = req.requestedBy === actorUserId;
      if (!canApprove && !isOwner) {
        return err(errors.forbidden('Nur der Anfragesteller oder ein Trainer/Admin darf stornieren'));
      }
    }

    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('substitute_requests')
        .update({
          status:          targetStatus,
          resolution_note: parsed.data.resolution_note ?? null,
          resolved_by:     actorUserId,
          // resolved_at wird durch DB-Trigger gesetzt
        })
        .eq('id', id)
        .select(`
          *,
          schedule_matches(match_date, match_day, home_team, away_team),
          teams(name),
          members!substitute_member_id(first_name, last_name, ttr_rating)
        `)
        .single();
      if (error) throw error;
      return toUI(data as JoinedRow);
    }, (e) => {
      const msg = getErrorMessage(e);
      if (msg.includes('Übergang')) return errors.validation(msg);
      return fromSupabaseError(e as { message: string; code?: string });
    });
  },

  // ── Convenience-Methoden ──────────────────────────────────────────────────────

  async approve(
    id: string,
    actorRole: AppRole,
    actorUserId: string,
    resolutionNote?: string,
  ): Promise<ApiResult<SubstituteRequestUI>> {
    return substituteService.resolve(
      id,
      { status: 'accepted', resolution_note: resolutionNote },
      actorRole,
      actorUserId,
    );
  },

  async decline(
    id: string,
    actorRole: AppRole,
    actorUserId: string,
    resolutionNote?: string,
  ): Promise<ApiResult<SubstituteRequestUI>> {
    return substituteService.resolve(
      id,
      { status: 'declined', resolution_note: resolutionNote },
      actorRole,
      actorUserId,
    );
  },

  async cancel(
    id: string,
    actorRole: AppRole,
    actorUserId: string,
    resolutionNote?: string,
  ): Promise<ApiResult<SubstituteRequestUI>> {
    return substituteService.resolve(
      id,
      { status: 'cancelled', resolution_note: resolutionNote },
      actorRole,
      actorUserId,
    );
  },

  /**
   * Alle Anfragen für ein Spiel stornieren.
   * Use-Case: Spiel wird verlegt oder abgesagt.
   *
   * Berechtigung: substitute:approve
   * Überspringt bereits terminale Einträge (declined/cancelled).
   */
  async cancelAllForMatch(
    matchId: string,
    actorRole: AppRole,
    actorUserId: string,
    resolutionNote = 'Spiel verlegt oder abgesagt',
  ): Promise<ApiResult<{ cancelled: number; skipped: number }>> {
    if (!hasPermission(actorRole, 'substitute:approve')) {
      return err(errors.forbidden('Massenstornierung von Ersatz-Anfragen'));
    }

    return tryCatch(async () => {
      // Nur nicht-terminale Einträge stornieren
      const { data, error } = await supabase
        .from('substitute_requests')
        .update({
          status:          'cancelled',
          resolution_note: resolutionNote,
          resolved_by:     actorUserId,
        })
        .eq('match_id', matchId)
        .in('status', ['pending', 'accepted'])
        .select('id');
      if (error) throw error;

      return { cancelled: (data ?? []).length, skipped: 0 };
    }, toAppError);
  },
};
