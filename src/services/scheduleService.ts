/**
 * scheduleService
 *
 * Kanonischer Service für Spielplan-Operationen.
 * Ersetzt mittelfristig den matchService (bleibt für Abwärtskompatibilität).
 *
 * Verantwortlichkeiten:
 *   - CRUD für schedule_matches mit vollständiger Validierung
 *   - Bulk-Update für PIN/Code (Masseneingabe)
 *   - click-TT CSV Import mit Konflikt-Behandlung
 *   - Zentralisierte Sortier- und Datums-Logik
 *   - Home/Away-Derivation via clicktt.ts
 *
 * API-Konvention: alle Methoden geben ApiResult<T> zurück.
 * Thrown exceptions werden in err() normalisiert.
 */

import { supabase } from '@/integrations/supabase/client';
import type { ScheduleMatch, ScheduleMatchInsert } from '@/types';
import type { ApiResult, AppError } from '@/types/api';
import { ok, err, tryCatch } from '@/lib/api';
import { errors, fromSupabaseError, getErrorMessage } from '@/lib/error';
import {
  matchCreateSchema,
  matchUpdateSchema,
  matchResultSchema,
  matchFilterSchema,
  pinCodeEntrySchema,
} from '@/schemas/match.schema';
import type {
  MatchCreateInput,
  MatchUpdateInput,
  MatchResultInput,
  MatchFilterInput,
  PinCodeEntry,
} from '@/schemas/match.schema';
import { parseClickTTCsv } from '@/lib/clicktt';
import type { NormalizedMatch, ClickTTParseResult } from '@/lib/clicktt';
import { z } from 'zod';

// ─── Re-Exporte für Aufrufer ─────────────────────────────────────────────────

export type { NormalizedMatch, ClickTTParseResult };
export { parseClickTTCsv };

// ─── Venue-Join-Typ ───────────────────────────────────────────────────────────

export interface VenueSummary {
  name: string;
  street: string | null;
  city: string | null;
  zip_code: string | null;
}

/** ScheduleMatch mit optionalem Venue-JOIN (für Team-Spielplan-Seite). */
export type ScheduleMatchFull = ScheduleMatch & {
  venues: VenueSummary | null;
};

// ─── Import-Typen ─────────────────────────────────────────────────────────────

/** Normalisierte Zeile nach Konflikt-Prüfung. */
export interface MatchImportRow {
  normalized: NormalizedMatch;
  /** ID eines bereits vorhandenen Spiels, falls Konflikt erkannt. */
  conflictId: string | null;
  /** Konfliktstrategie: dayMatch | dateMatch | none */
  conflictReason: 'dayMatch' | 'dateMatch' | 'none';
}

/**
 * Konflikt-Strategie beim Import:
 *   skip   – vorhandene Spiele beibehalten, neue nur einfügen
 *   update – vorhandene Spiele mit Import-Daten überschreiben
 *   insert – immer einfügen (Duplikate möglich, wenn kein DB-Constraint)
 */
export type ImportConflictMode = 'skip' | 'update' | 'insert';

export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ index: number; message: string }>;
}

export interface BulkPinCodeResult {
  updated: number;
  errors: string[];
}

// ─── Internes ────────────────────────────────────────────────────────────────

/** AppError-Extraktion aus gefangenem Wert. */
const toAppError = (e: unknown): AppError => {
  if (e != null && typeof e === 'object' && 'code' in e && 'message' in e) {
    return e as AppError;
  }
  return errors.internal(getErrorMessage(e));
};

/**
 * Zentralisierte Sortierung für Spielplan-Queries.
 * Reihenfolge: match_date ASC → match_time ASC (nulls last) → match_day ASC (nulls last)
 */
function applySortOrder<T extends ReturnType<typeof supabase.from>>(
  query: T,
): T {
  return (query as any)
    .order('match_date', { ascending: true })
    .order('match_time', { ascending: true, nullsFirst: false })
    .order('match_day', { ascending: true, nullsFirst: false }) as T;
}

/**
 * Konvertiert eine NormalizedMatch-Zeile in eine DB-Insert-Zeile.
 * Felder team_id und season_id werden vom Aufrufer gesetzt.
 */
function normalizedToInsert(
  m: NormalizedMatch,
): Omit<ScheduleMatchInsert, 'team_id' | 'season_id'> {
  return {
    match_day: m.match_day,
    match_date: m.match_date,
    match_time: m.match_time,
    home_team: m.home_team,
    away_team: m.away_team,
    home_score: m.home_score,
    away_score: m.away_score,
    is_home: m.is_home,
    status: m.status,
    pin: m.pin,
    code: m.code,
    // venue_name wird nicht direkt gespeichert (kein TEXT-Feld in schedule_matches)
    // → venue_id-Mapping muss separat erfolgen
  };
}

// ─── Venue-Adresse formatieren ────────────────────────────────────────────────

/**
 * Formatiert eine Venue-Adresse für die Anzeige.
 * Beispiel: "Stadthalle · Hauptstraße 1, 12345 Berlin"
 */
export function formatVenueAddress(venue: VenueSummary | null | undefined): string {
  if (!venue) return '';
  const parts: string[] = [venue.name];
  const addrParts = [venue.street, [venue.zip_code, venue.city].filter(Boolean).join(' ')]
    .filter(Boolean);
  if (addrParts.length > 0) parts.push(addrParts.join(', '));
  return parts.join(' · ');
}

// ─── scheduleService ──────────────────────────────────────────────────────────

export const scheduleService = {
  // ── READ ──────────────────────────────────────────────────────────────────

  /**
   * Gibt Spiele zurück, optional gefiltert.
   *
   * Unterstützte Filter:
   *   team_id    – Nur Spiele dieser Mannschaft
   *   season_id  – Nur Spiele dieser Saison
   *   status     – Statusfilter
   *   from_date  – Nur Spiele ab diesem Datum (YYYY-MM-DD, inklusiv)
   *   to_date    – Nur Spiele bis zu diesem Datum (YYYY-MM-DD, inklusiv)
   *
   * Sortierung: match_date → match_time (nulls last) → match_day (nulls last)
   */
  async list(filters: MatchFilterInput = {}): Promise<ApiResult<ScheduleMatch[]>> {
    const parsed = matchFilterSchema.safeParse(filters);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.flatten()));
    }
    const { team_id, season_id, status, from_date, to_date } = parsed.data;

    return tryCatch(async () => {
      let q = supabase.from('schedule_matches').select('*');
      if (team_id) q = q.eq('team_id', team_id);
      if (season_id) q = q.eq('season_id', season_id);
      if (status) q = q.eq('status', status);
      if (from_date) q = q.gte('match_date', from_date);
      if (to_date) q = q.lte('match_date', to_date);
      const { data, error } = await applySortOrder(q);
      if (error) throw fromSupabaseError(error);
      return (data ?? []) as ScheduleMatch[];
    }, toAppError);
  },

  /**
   * Team-Spielplan mit gejointen Venue-Daten (für die ScheduleTeam-Seite).
   * Nutzt idx_schedule_matches_season_team_date.
   */
  async listWithVenue(teamId: string): Promise<ApiResult<ScheduleMatchFull[]>> {
    if (!teamId) return err(errors.validation('team_id ist erforderlich'));
    return tryCatch(async () => {
      const q = supabase
        .from('schedule_matches')
        .select('*, venues(name, street, city, zip_code)')
        .eq('team_id', teamId);
      const { data, error } = await applySortOrder(q);
      if (error) throw fromSupabaseError(error);
      return (data ?? []) as unknown as ScheduleMatchFull[];
    }, toAppError);
  },

  async getById(id: string): Promise<ApiResult<ScheduleMatch | null>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('schedule_matches')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw fromSupabaseError(error);
      return data as ScheduleMatch | null;
    }, toAppError);
  },

  // ── WRITE ─────────────────────────────────────────────────────────────────

  async create(input: MatchCreateInput): Promise<ApiResult<ScheduleMatch>> {
    const parsed = matchCreateSchema.safeParse(input);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.flatten()));
    }
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('schedule_matches')
        .insert(parsed.data as ScheduleMatchInsert)
        .select()
        .single();
      if (error) throw fromSupabaseError(error);
      return data as ScheduleMatch;
    }, toAppError);
  },

  async update(id: string, input: MatchUpdateInput): Promise<ApiResult<ScheduleMatch>> {
    const parsed = matchUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.flatten()));
    }
    if (Object.keys(parsed.data).length === 0) {
      return err(errors.validation('Keine Felder zum Aktualisieren angegeben'));
    }
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('schedule_matches')
        .update(parsed.data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw fromSupabaseError(error);
      return data as ScheduleMatch;
    }, toAppError);
  },

  /**
   * Ergebnis-Update mit strikter Validierung.
   *
   * Regeln (in matchResultSchema erzwungen):
   *   - Beide Scores müssen gesetzt oder beide null sein
   *   - Status 'beendet' setzt beide Scores voraus
   *   - Status 'abgesagt'/'verschoben' erwartet keine Scores
   */
  async updateResult(id: string, input: MatchResultInput): Promise<ApiResult<ScheduleMatch>> {
    const parsed = matchResultSchema.safeParse(input);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.flatten()));
    }
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('schedule_matches')
        .update({
          home_score: parsed.data.home_score,
          away_score: parsed.data.away_score,
          status: parsed.data.status,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw fromSupabaseError(error);
      return data as ScheduleMatch;
    }, toAppError);
  },

  async remove(id: string): Promise<ApiResult<void>> {
    return tryCatch(async () => {
      const { error } = await supabase.from('schedule_matches').delete().eq('id', id);
      if (error) throw fromSupabaseError(error);
    }, toAppError);
  },

  // ── BULK ──────────────────────────────────────────────────────────────────

  /**
   * Bulk-Update für PIN und Code.
   *
   * Validiert alle Einträge vorab (Schema).
   * Führt Updates parallel aus (Promise.allSettled → keine Unterbrechung bei Einzelfehler).
   * Gibt eine Zusammenfassung zurück: {updated, errors}.
   */
  async bulkUpdatePinCode(entries: PinCodeEntry[]): Promise<ApiResult<BulkPinCodeResult>> {
    const parsed = z.array(pinCodeEntrySchema).safeParse(entries);
    if (!parsed.success) {
      return err(errors.validation('Ungültige Einträge', parsed.error.flatten()));
    }
    if (parsed.data.length === 0) {
      return ok({ updated: 0, errors: [] });
    }

    return tryCatch(async () => {
      const results = await Promise.allSettled(
        parsed.data.map((entry) =>
          supabase
            .from('schedule_matches')
            .update({ pin: entry.pin, code: entry.code })
            .eq('id', entry.id),
        ),
      );

      let updated = 0;
      const errMsgs: string[] = [];

      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          errMsgs.push(`Zeile ${i + 1}: ${getErrorMessage(r.reason)}`);
        } else if (r.value.error) {
          errMsgs.push(`Zeile ${i + 1}: ${r.value.error.message}`);
        } else {
          updated++;
        }
      });

      return { updated, errors: errMsgs };
    }, toAppError);
  },

  // ── IMPORT ────────────────────────────────────────────────────────────────

  /**
   * Prüft normalisierte Import-Zeilen auf Konflikte mit vorhandenen Spielen.
   *
   * Konflikt-Erkennung (Priorität):
   *   1. Spieltag-Match:  selber match_day im selben Team+Saison-Kontext
   *   2. Datum-Match:     selbes match_date (nur wenn kein match_day vorhanden)
   *
   * @returns Zeilen mit conflictId und conflictReason annotiert.
   */
  async detectConflicts(
    rows: NormalizedMatch[],
    teamId: string,
    seasonId: string,
  ): Promise<MatchImportRow[]> {
    // Bestehende Spiele für dieses Team in dieser Saison laden
    const { data: existing } = await supabase
      .from('schedule_matches')
      .select('id, match_day, match_date')
      .eq('team_id', teamId)
      .eq('season_id', seasonId);

    const byDay = new Map<number, string>();
    const byDate = new Map<string, string>();

    (existing ?? []).forEach((m) => {
      if (m.match_day != null) byDay.set(m.match_day, m.id);
      // Datum-Map nur für Einträge ohne match_day (schwächere Kennung)
      if (m.match_day == null) byDate.set(m.match_date, m.id);
    });

    return rows.map((normalized) => {
      // 1) Spieltag-Konflikt
      if (normalized.match_day != null && byDay.has(normalized.match_day)) {
        return {
          normalized,
          conflictId: byDay.get(normalized.match_day)!,
          conflictReason: 'dayMatch',
        };
      }
      // 2) Datum-Konflikt (nur wenn kein match_day im Import)
      if (normalized.match_day == null && byDate.has(normalized.match_date)) {
        return {
          normalized,
          conflictId: byDate.get(normalized.match_date)!,
          conflictReason: 'dateMatch',
        };
      }
      return { normalized, conflictId: null, conflictReason: 'none' };
    });
  },

  /**
   * Importiert normalisierte Zeilen in die Datenbank.
   *
   * Konflikt-Strategien:
   *   skip   – Nur neue Zeilen einfügen, Konflikte überspringen
   *   update – Konflikte aktualisieren, neue einfügen
   *   insert – Alle einfügen (ignoriert Konflikte; kann Duplikate erzeugen)
   *
   * Inserts werden gebatcht (100 pro Request), Updates sequenziell.
   */
  async importRows(
    rows: MatchImportRow[],
    teamId: string,
    seasonId: string,
    mode: ImportConflictMode = 'skip',
  ): Promise<ApiResult<ImportResult>> {
    if (!teamId || !seasonId) {
      return err(errors.validation('team_id und season_id sind erforderlich'));
    }

    const toInsert = mode === 'insert'
      ? rows
      : rows.filter((r) => r.conflictId === null);

    const toUpdate = mode === 'update'
      ? rows.filter((r) => r.conflictId !== null)
      : [];

    const skipped = mode === 'skip'
      ? rows.filter((r) => r.conflictId !== null).length
      : 0;

    let inserted = 0;
    let updated = 0;
    const importErrors: Array<{ index: number; message: string }> = [];

    // ── Inserts (gebatcht) ──
    const BATCH_SIZE = 100;
    const insertRows = toInsert.map((r) => ({
      team_id: teamId,
      season_id: seasonId,
      ...normalizedToInsert(r.normalized),
    }));

    for (let i = 0; i < insertRows.length; i += BATCH_SIZE) {
      const chunk = insertRows.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from('schedule_matches')
        .insert(chunk as ScheduleMatchInsert[])
        .select('id');

      if (error) {
        importErrors.push({
          index: i,
          message: `Batch-Insert (Zeilen ${i + 1}–${i + chunk.length}): ${error.message}`,
        });
      } else {
        inserted += data?.length ?? 0;
      }
    }

    // ── Updates (sequenziell, um Fehler-Zuordnung zu behalten) ──
    for (let i = 0; i < toUpdate.length; i++) {
      const row = toUpdate[i];
      const { error } = await supabase
        .from('schedule_matches')
        .update(normalizedToInsert(row.normalized))
        .eq('id', row.conflictId!);

      if (error) {
        importErrors.push({
          index: i,
          message: `Update ID ${row.conflictId}: ${error.message}`,
        });
      } else {
        updated++;
      }
    }

    return ok({ inserted, updated, skipped, errors: importErrors });
  },
};
