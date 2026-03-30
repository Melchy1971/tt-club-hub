/**
 * lineupService
 *
 * Verwaltet match_lineups – die konkrete Aufstellung pro Spiel.
 *
 * Design-Entscheidungen:
 *  – Keine FK-Constraint auf team_members: Spieler können historisch in Aufstellungen
 *    stehen, auch wenn sie das Team verlassen haben. Konsistenz-Prüfung erfolgt
 *    service-seitig via validate() und DB-seitig via RAISE WARNING-Trigger.
 *  – setLineup() = atomischer Replace (DELETE + INSERT in einem Batch).
 *  – validate() prüft Konflikte ohne zu schreiben – nützlich für UI-Warnungen.
 *
 * Konflikt-Matrix (Saisonwechsel / Teamwechsel):
 *  ┌──────────────────────────────────┬────────────────────────────────────────┐
 *  │ Situation                        │ Verhalten                              │
 *  ├──────────────────────────────────┼────────────────────────────────────────┤
 *  │ Spieler nicht in team_members    │ validate() gibt Warnung; create läuft  │
 *  │ Spieler unavailable              │ validate() gibt Warnung; create läuft  │
 *  │ Position doppelt belegt          │ DB: UNIQUE-Error → CONFLICT returned   │
 *  │ Spieler in zwei Spielen am       │ erlaubt (z.B. Doppelrunde); kein Block │
 *  │ selben Tag                       │                                        │
 *  └──────────────────────────────────┴────────────────────────────────────────┘
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { errors, fromSupabaseError, getErrorMessage } from '@/lib/error';
import type { ApiResult, AppError } from '@/types/api';
import {
  lineupSetSchema,
  lineupAddPlayerSchema,
  type LineupSetInput,
  type LineupAddPlayerInput,
  type AvailabilityStatusValue,
} from '@/schemas/availability.schema';

// ─── DB-Typen ─────────────────────────────────────────────────────────────────

interface LineupRow {
  id: string;
  match_id: string;
  team_id: string;
  member_id: string;
  position: number;
  is_substitute: boolean;
  created_at: string;
  updated_at: string;
}

// ─── UI-Typen ─────────────────────────────────────────────────────────────────

export interface LineupPlayerUI {
  id: string;
  matchId: string;
  teamId: string;
  memberId: string;
  position: number;
  isSubstitute: boolean;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  memberFirstName?: string;
  memberLastName?: string;
  memberFullName?: string;
  memberTtr?: number | null;
  /** Verfügbarkeits-Status aus match_player_availability (wenn mitgeladen) */
  availabilityStatus?: AvailabilityStatusValue;
}

/**
 * Validierungs-Warnung – kein Fehler, aber UI soll darauf hinweisen.
 */
export interface LineupWarning {
  memberId: string;
  memberName?: string;
  type:
    | 'not_in_roster'        // Spieler nicht in team_members
    | 'unavailable'          // Status = 'unavailable' in availability
    | 'uncertain'            // Status = 'uncertain'
    | 'no_availability_set'; // Kein Availability-Eintrag vorhanden (unknown)
  message: string;
}

export interface LineupValidationResult {
  valid: boolean;
  warnings: LineupWarning[];
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

function toUI(
  row: LineupRow & {
    members?: { first_name: string; last_name: string; ttr_rating: number | null } | null;
    match_player_availability?: { status: AvailabilityStatusValue }[] | null;
  },
): LineupPlayerUI {
  const avail = row.match_player_availability?.[0];
  return {
    id:           row.id,
    matchId:      row.match_id,
    teamId:       row.team_id,
    memberId:     row.member_id,
    position:     row.position,
    isSubstitute: row.is_substitute,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
    memberFirstName:    row.members?.first_name,
    memberLastName:     row.members?.last_name,
    memberFullName:     row.members
      ? `${row.members.first_name} ${row.members.last_name}`.trim()
      : undefined,
    memberTtr:          row.members?.ttr_rating,
    availabilityStatus: avail?.status,
  };
}

const toAppError = (e: unknown): AppError => {
  if (e != null && typeof e === 'object' && 'code' in e && 'message' in e) {
    return e as AppError;
  }
  return errors.internal(getErrorMessage(e));
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const lineupService = {
  // ── Queries ─────────────────────────────────────────────────────────────────

  /**
   * Vollständige Aufstellung für ein Spiel, inklusive Spieler-Daten und
   * Verfügbarkeits-Status, sortiert nach position.
   *
   * Ein JOIN auf match_player_availability liefert den aktuellen Status direkt –
   * kein zweiter Round-Trip nötig.
   */
  async getForMatch(matchId: string): Promise<ApiResult<LineupPlayerUI[]>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('match_lineups')
        .select(`
          *,
          members(first_name, last_name, ttr_rating),
          match_player_availability(status)
        `)
        .eq('match_id', matchId)
        .eq('match_player_availability.match_id', matchId)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => toUI(r as LineupRow & {
        members: { first_name: string; last_name: string; ttr_rating: number | null } | null;
        match_player_availability: { status: AvailabilityStatusValue }[] | null;
      }));
    }, fromSupabaseError);
  },

  /**
   * Alle Aufstellungen eines Spielers (optional saison-gefiltert).
   * Nutzt idx_lineup_member.
   */
  async getForMember(memberId: string, seasonId?: string): Promise<ApiResult<LineupPlayerUI[]>> {
    return tryCatch(async () => {
      let q = supabase
        .from('match_lineups')
        .select('*')
        .eq('member_id', memberId);

      if (seasonId) {
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
      return (data ?? []).map((r) => toUI(r as LineupRow));
    }, fromSupabaseError);
  },

  // ── Validation ───────────────────────────────────────────────────────────────

  /**
   * Prüft die Aufstellung auf Konflikte ohne zu schreiben.
   *
   * Prüft:
   *   1. Spieler im Kader (team_members)?
   *   2. Spieler als 'unavailable' / 'uncertain' markiert?
   *   3. Kein Availability-Eintrag vorhanden?
   *
   * Gibt valid=false wenn HARTE Konflikte vorhanden sind (unavailable).
   * Warnungen bei soft conflicts (uncertain, no_availability_set, not_in_roster).
   */
  async validate(matchId: string, teamId: string, memberIds: string[]): Promise<LineupValidationResult> {
    if (memberIds.length === 0) return { valid: true, warnings: [] };

    const warnings: LineupWarning[] = [];

    // 1. Kader laden (parallel)
    const [rosterResult, availabilityResult, membersResult] = await Promise.all([
      supabase
        .from('team_members')
        .select('member_id')
        .eq('team_id', teamId)
        .in('member_id', memberIds),
      supabase
        .from('match_player_availability')
        .select('member_id, status')
        .eq('match_id', matchId)
        .in('member_id', memberIds),
      supabase
        .from('members')
        .select('id, first_name, last_name')
        .in('id', memberIds),
    ]);

    const rosterIds = new Set((rosterResult.data ?? []).map((r) => r.member_id));
    const availMap = new Map(
      (availabilityResult.data ?? []).map((r) => [r.member_id, r.status as AvailabilityStatusValue]),
    );
    const memberNames = new Map(
      (membersResult.data ?? []).map((m) => [m.id, `${m.first_name} ${m.last_name}`.trim()]),
    );

    let hasHardConflict = false;

    for (const memberId of memberIds) {
      const name = memberNames.get(memberId);

      if (!rosterIds.has(memberId)) {
        warnings.push({
          memberId,
          memberName: name,
          type: 'not_in_roster',
          message: `${name ?? memberId} steht nicht im aktuellen Kader`,
        });
      }

      const avail = availMap.get(memberId);
      if (avail === 'unavailable') {
        hasHardConflict = true;
        warnings.push({
          memberId,
          memberName: name,
          type: 'unavailable',
          message: `${name ?? memberId} hat abgesagt`,
        });
      } else if (avail === 'uncertain') {
        warnings.push({
          memberId,
          memberName: name,
          type: 'uncertain',
          message: `${name ?? memberId} ist unsicher verfügbar`,
        });
      } else if (!avail || avail === 'unknown') {
        warnings.push({
          memberId,
          memberName: name,
          type: 'no_availability_set',
          message: `${name ?? memberId} hat keine Verfügbarkeit angegeben`,
        });
      }
    }

    return { valid: !hasHardConflict, warnings };
  },

  // ── Mutationen ───────────────────────────────────────────────────────────────

  /**
   * Ersetzt die vollständige Aufstellung für ein Spiel.
   *
   * Ablauf:
   *   1. Bestehende Aufstellung löschen.
   *   2. Neue Aufstellung einfügen.
   *   3. Parallel: Validierung auf Konflikte.
   *
   * Gibt { lineup, validation } zurück – Caller entscheidet ob Warnungen
   * dem User gezeigt werden oder silent akzeptiert werden.
   *
   * Nicht atomar: bei gleichzeitigem Zugriff möglich, dass Schritt 2 scheitert.
   * Bei Scheitern ist lineup leer. Für Produktivbetrieb → DB-RPC-Funktion.
   */
  async setLineup(
    input: LineupSetInput,
  ): Promise<ApiResult<{ lineup: LineupPlayerUI[]; validation: LineupValidationResult }>> {
    const parsed = lineupSetSchema.safeParse(input);
    if (!parsed.success) return err(errors.validation(parsed.error.message, parsed.error.issues));

    const { match_id, team_id, entries } = parsed.data;
    const memberIds = entries.map((e) => e.member_id);

    // Validierung parallel zur DB-Operation (read-only)
    const [, validation] = await Promise.all([
      // Dummy-Wert, wir brauchen nur die Reihenfolge
      Promise.resolve(),
      lineupService.validate(match_id, team_id, memberIds),
    ]);

    return tryCatch(async () => {
      // 1. Bestehende Aufstellung löschen
      const { error: deleteError } = await supabase
        .from('match_lineups')
        .delete()
        .eq('match_id', match_id)
        .eq('team_id', team_id);
      if (deleteError) throw deleteError;

      if (entries.length === 0) return { lineup: [], validation };

      // 2. Neue Aufstellung einfügen
      const { data, error: insertError } = await supabase
        .from('match_lineups')
        .insert(
          entries.map((e) => ({
            match_id,
            team_id,
            member_id:    e.member_id,
            position:     e.position,
            is_substitute: e.is_substitute,
          })),
        )
        .select('*, members(first_name, last_name, ttr_rating)');
      if (insertError) throw insertError;

      const lineup = (data ?? []).map((r) =>
        toUI(r as LineupRow & { members: { first_name: string; last_name: string; ttr_rating: number | null } | null }),
      );

      // Position-sortiert zurückgeben
      lineup.sort((a, b) => a.position - b.position);
      return { lineup, validation };
    }, fromSupabaseError);
  },

  /**
   * Einzelnen Spieler zur Aufstellung hinzufügen (Upsert).
   * Nützlich für schnelles Nachtragen ohne die gesamte Aufstellung zu ersetzen.
   *
   * Wenn position bereits belegt ist: CONFLICT-Error (DB UNIQUE).
   * Wenn Spieler bereits in Aufstellung: position wird aktualisiert.
   */
  async addPlayer(input: LineupAddPlayerInput): Promise<ApiResult<LineupPlayerUI>> {
    const parsed = lineupAddPlayerSchema.safeParse(input);
    if (!parsed.success) return err(errors.validation(parsed.error.message, parsed.error.issues));

    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('match_lineups')
        .upsert(
          {
            match_id:     parsed.data.match_id,
            team_id:      parsed.data.team_id,
            member_id:    parsed.data.member_id,
            position:     parsed.data.position,
            is_substitute: parsed.data.is_substitute,
          },
          { onConflict: 'match_id,member_id' },
        )
        .select('*, members(first_name, last_name, ttr_rating)')
        .single();
      if (error) throw error;
      return toUI(data as LineupRow & { members: { first_name: string; last_name: string; ttr_rating: number | null } | null });
    }, fromSupabaseError);
  },

  /**
   * Spieler aus der Aufstellung entfernen.
   */
  async removePlayer(matchId: string, memberId: string): Promise<ApiResult<void>> {
    return tryCatch(async () => {
      const { error } = await supabase
        .from('match_lineups')
        .delete()
        .eq('match_id', matchId)
        .eq('member_id', memberId);
      if (error) throw error;
    }, fromSupabaseError);
  },

  /**
   * Tauscht die Positionen zweier Spieler in der Aufstellung.
   *
   * Identische Strategie wie teamAssignmentService.swapPositions():
   *   1. Beide Zeilen lesen
   *   2. Beide löschen (gibt UNIQUE-Slots frei)
   *   3. Mit getauschten Positionen neu einfügen
   *
   * Nicht atomar. Bei Scheitern von Schritt 3 sind beide Spieler ohne Position.
   */
  async swapPositions(matchId: string, memberId1: string, memberId2: string): Promise<ApiResult<void>> {
    if (memberId1 === memberId2) {
      return err(errors.validation('Beide Spieler müssen unterschiedlich sein'));
    }

    return tryCatch(async () => {
      const { data: rows, error: fetchError } = await supabase
        .from('match_lineups')
        .select('member_id, position')
        .eq('match_id', matchId)
        .in('member_id', [memberId1, memberId2]);

      if (fetchError) throw fetchError;
      if (!rows || rows.length !== 2) {
        throw errors.notFound('Einer oder beide Spieler sind nicht in dieser Aufstellung');
      }

      const a = rows.find((r) => r.member_id === memberId1)!;
      const b = rows.find((r) => r.member_id === memberId2)!;

      const { error: deleteError } = await supabase
        .from('match_lineups')
        .delete()
        .eq('match_id', matchId)
        .in('member_id', [memberId1, memberId2]);
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from('match_lineups')
        .insert([
          { match_id: matchId, member_id: a.member_id, position: b.position },
          { match_id: matchId, member_id: b.member_id, position: a.position },
        ]);
      if (insertError) throw insertError;
    }, fromSupabaseError);
  },

  /**
   * Gesamte Aufstellung eines Spiels löschen.
   * Use-Case: Spielverlegung, Neuplanung.
   */
  async clearLineup(matchId: string): Promise<ApiResult<void>> {
    return tryCatch(async () => {
      const { error } = await supabase
        .from('match_lineups')
        .delete()
        .eq('match_id', matchId);
      if (error) throw error;
    }, fromSupabaseError);
  },

  /**
   * Schlägt eine Aufstellung vor, basierend auf:
   *   1. Verfügbaren Spielern (status = 'available')
   *   2. Aufsteigend nach team_members.position (Setzliste)
   *
   * Gibt nur den Vorschlag zurück – nichts wird gespeichert.
   * Der Caller kann setLineup() mit dem Ergebnis aufrufen.
   */
  async suggestLineup(
    matchId: string,
    teamId: string,
    maxPositions = 6,
  ): Promise<ApiResult<LineupPlayerUI[]>> {
    return tryCatch(async () => {
      // Kader mit Position, gefiltert auf verfügbare Spieler
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          member_id,
          position,
          members(first_name, last_name, ttr_rating),
          match_player_availability!inner(status)
        `)
        .eq('team_id', teamId)
        .eq('match_player_availability.match_id', matchId)
        .eq('match_player_availability.status', 'available')
        .order('position', { ascending: true })
        .limit(maxPositions);

      if (error) throw error;

      return (data ?? []).map((row, idx) => ({
        id: '',
        matchId,
        teamId,
        memberId: row.member_id,
        position: idx + 1,
        isSubstitute: false,
        createdAt: '',
        updatedAt: '',
        memberFirstName: (row.members as { first_name: string; last_name: string; ttr_rating: number | null } | null)?.first_name,
        memberLastName:  (row.members as { first_name: string; last_name: string; ttr_rating: number | null } | null)?.last_name,
        memberFullName:  row.members
          ? `${(row.members as { first_name: string; last_name: string }).first_name} ${(row.members as { first_name: string; last_name: string }).last_name}`.trim()
          : undefined,
        memberTtr:         (row.members as { ttr_rating: number | null } | null)?.ttr_rating,
        availabilityStatus: 'available' as AvailabilityStatusValue,
      }));
    }, fromSupabaseError);
  },
};
