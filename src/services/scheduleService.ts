import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { errors, fromSupabaseError } from '@/lib/error';
import { todayISO } from '@/lib/date';
import type { ApiResult } from '@/types/api';
import type { ScheduleMatch, ScheduleMatchInsert } from '@/types';
import {
  scheduleMatchCreateSchema,
  scheduleMatchUpdateSchema,
  scheduleMatchFilterSchema,
  bulkPinCodeSchema,
  clickTTRowSchema,
  type ScheduleMatchCreateInput,
  type ScheduleMatchUpdateInput,
  type ScheduleMatchFilterInput,
  type BulkPinCodeInput,
  type ClickTTRow,
} from '@/schemas/schedule.schema';

// ─── UI-Typ ────────────────────────────────────────────────────────────────────

export interface ScheduleMatchUI {
  id: string;
  seasonId: string;
  seasonPhaseId: string | null;
  teamId: string;
  matchDate: string;       // ISO YYYY-MM-DD
  matchTime: string | null; // HH:MM
  matchDay: number | null;
  homeTeam: string;
  awayTeam: string;
  /** Eigene Mannschaft spielt zu Hause */
  isHome: boolean;
  homeScore: number | null;
  awayScore: number | null;
  venueId: string | null;
  status: string;
  pin: string | null;
  code: string | null;
  reportText: string | null;
  createdAt: string;
  updatedAt: string;
  // Abgeleitete Felder
  /** Spieltag ist in der Vergangenheit */
  isPast: boolean;
  /** Spieltag ist heute */
  isToday: boolean;
  /** Eigene Mannschaft hat gewonnen */
  hasWon: boolean | null;
}

// ─── Mapping ───────────────────────────────────────────────────────────────────

function toUI(row: ScheduleMatch): ScheduleMatchUI {
  const today = todayISO();
  const isPast = row.match_date < today;
  const isToday = row.match_date === today;

  let hasWon: boolean | null = null;
  if (row.home_score != null && row.away_score != null) {
    hasWon = row.is_home
      ? row.home_score > row.away_score
      : row.away_score > row.home_score;
  }

  return {
    id: row.id,
    seasonId: row.season_id,
    seasonPhaseId: row.season_phase_id,
    teamId: row.team_id,
    matchDate: row.match_date,
    matchTime: row.match_time,
    matchDay: row.match_day,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    isHome: row.is_home,
    homeScore: row.home_score,
    awayScore: row.away_score,
    venueId: row.venue_id,
    status: row.status,
    pin: row.pin,
    code: row.code,
    reportText: row.report_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isPast,
    isToday,
    hasWon,
  };
}

// ─── Sortierung ────────────────────────────────────────────────────────────────

/**
 * Kanonische Sortierung: Datum aufsteigend, bei Gleichstand match_day,
 * dann match_time (null ans Ende).
 */
export function sortMatches(matches: ScheduleMatchUI[]): ScheduleMatchUI[] {
  return [...matches].sort((a, b) => {
    const dateCmp = a.matchDate.localeCompare(b.matchDate);
    if (dateCmp !== 0) return dateCmp;
    const dayCmp = (a.matchDay ?? 999) - (b.matchDay ?? 999);
    if (dayCmp !== 0) return dayCmp;
    const ta = a.matchTime ?? '99:99';
    const tb = b.matchTime ?? '99:99';
    return ta.localeCompare(tb);
  });
}

// ─── Datums-Normalisierung ─────────────────────────────────────────────────────

/**
 * Konvertiert deutsches Datum "DD.MM.YYYY" → ISO "YYYY-MM-DD".
 * Gibt null zurück, wenn das Format nicht erkannt wird.
 */
export function parseGermanDate(raw: string): string | null {
  const trimmed = raw.trim();
  // Bereits ISO-Format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // Deutsches Format DD.MM.YYYY
  const m = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/**
 * Normalisiert Uhrzeit "HH:MM" oder "HH:MM:SS" → "HH:MM".
 * Gibt null zurück wenn leer oder unbekannt.
 */
export function parseTime(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

// ─── Home/Away-Derivation ──────────────────────────────────────────────────────

/**
 * Leitet `is_home` her, indem der Vereinsname mit `home_team` verglichen wird.
 *
 * Strategie (robust gegen Satzzeichen / Groß-Kleinschreibung):
 * 1. Exakter Treffer (case-insensitive, getrimmt)
 * 2. `home_team` enthält `clubTeamName` als Substring
 * 3. Fallback: false (Auswärts)
 */
export function deriveIsHome(homeTeam: string, clubTeamName: string): boolean {
  const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
  const h = normalize(homeTeam);
  const c = normalize(clubTeamName);
  return h === c || h.includes(c) || c.includes(h);
}

// ─── Score-Parsing ─────────────────────────────────────────────────────────────

/**
 * Parst ein Ergebnis-String "9:5" in { homeScore, awayScore }.
 * Gibt null zurück wenn das Format nicht erkannt wird.
 */
export function parseScore(
  raw: string,
): { homeScore: number; awayScore: number } | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-' || trimmed === ':') return null;
  const m = trimmed.match(/^(\d+):(\d+)$/);
  if (!m) return null;
  return { homeScore: parseInt(m[1], 10), awayScore: parseInt(m[2], 10) };
}

// ─── click-TT Normalisierung ───────────────────────────────────────────────────

export interface ClickTTImportRow {
  /** Eingabe-Zeile (0-basiert) für Fehlermeldungen */
  rowIndex: number;
  match: ScheduleMatchInsert;
}

export interface ClickTTImportResult {
  imported: ClickTTImportRow[];
  errors: Array<{ rowIndex: number; message: string }>;
}

/**
 * Normalisiert rohe click-TT-Zeilen zu `ScheduleMatchInsert`-Objekten.
 *
 * @param rows        Rohdaten aus dem click-TT-Export
 * @param teamId      UUID der eigenen Mannschaft
 * @param seasonId    UUID der Saison
 * @param clubTeamName Vereinsname wie in click-TT (für Home/Away-Derivation)
 */
export function normalizeClickTTRows(
  rows: unknown[],
  teamId: string,
  seasonId: string,
  seasonPhaseId: string,
  clubTeamName: string,
): ClickTTImportResult {
  const imported: ClickTTImportRow[] = [];
  const rowErrors: Array<{ rowIndex: number; message: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const parsed = clickTTRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      rowErrors.push({
        rowIndex: i,
        message: parsed.error.issues.map((iss) => iss.message).join('; '),
      });
      continue;
    }

    const row: ClickTTRow = parsed.data;
    const matchDate = parseGermanDate(row.date);
    if (!matchDate) {
      rowErrors.push({ rowIndex: i, message: `Ungültiges Datum: "${row.date}"` });
      continue;
    }

    const matchTime = parseTime(row.time);
    const isHome = deriveIsHome(row.home_team, clubTeamName);
    const scoreParsed = parseScore(row.result);

    let homeScore: number | null = null;
    let awayScore: number | null = null;
    let status: ScheduleMatchInsert['status'] = 'geplant';

    if (scoreParsed) {
      homeScore = scoreParsed.homeScore;
      awayScore = scoreParsed.awayScore;
      status = 'beendet';
    } else if (matchDate < todayISO()) {
      // Datum liegt in der Vergangenheit, kein Ergebnis → vermutlich verschoben
      status = 'geplant'; // Vorsichtig: Nutzer soll manuell anpassen
    }

    const insert: ScheduleMatchInsert = {
      team_id: teamId,
      season_id: seasonId,
      season_phase_id: seasonPhaseId,
      match_day: row.match_day,
      match_date: matchDate,
      match_time: matchTime,
      home_team: row.home_team.trim(),
      away_team: row.away_team.trim(),
      is_home: isHome,
      home_score: homeScore,
      away_score: awayScore,
      status,
    };

    imported.push({ rowIndex: i, match: insert });
  }

  return { imported, errors: rowErrors };
}

// ─── Service ───────────────────────────────────────────────────────────────────

export const scheduleService = {
  // --- Queries ---

  async list(filter: ScheduleMatchFilterInput = {}): Promise<ApiResult<ScheduleMatchUI[]>> {
    const parsed = scheduleMatchFilterSchema.safeParse(filter);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.issues));
    }
    const { team_id, season_id, season_phase_id, status, is_home, from_date, to_date, match_day } = parsed.data;

    return tryCatch(async () => {
      let q = supabase.from('schedule_matches').select('*');
      if (team_id)    q = q.eq('team_id', team_id);
      if (season_id)  q = q.eq('season_id', season_id);
      if (season_phase_id) q = q.eq('season_phase_id', season_phase_id);
      if (status)     q = q.eq('status', status);
      if (is_home != null) q = q.eq('is_home', is_home);
      if (from_date)  q = q.gte('match_date', from_date);
      if (to_date)    q = q.lte('match_date', to_date);
      if (match_day)  q = q.eq('match_day', match_day);

      const { data, error } = await q.order('match_date').order('match_time', { nullsFirst: false });
      if (error) throw error;
      return sortMatches((data ?? []).map(toUI));
    }, fromSupabaseError);
  },

  async getById(id: string): Promise<ApiResult<ScheduleMatchUI>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('schedule_matches')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw { message: `Spiel "${id}" nicht gefunden`, code: 'PGRST116' };
      return toUI(data);
    }, fromSupabaseError);
  },

  async getUpcoming(teamId: string, limit = 5): Promise<ApiResult<ScheduleMatchUI[]>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('schedule_matches')
        .select('*')
        .eq('team_id', teamId)
        .gte('match_date', todayISO())
        .eq('status', 'geplant')
        .order('match_date')
        .order('match_time', { nullsFirst: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map(toUI);
    }, fromSupabaseError);
  },

  // --- Mutationen ---

  async create(payload: ScheduleMatchCreateInput): Promise<ApiResult<ScheduleMatchUI>> {
    const parsed = scheduleMatchCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.issues));
    }
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('schedule_matches')
        .insert(parsed.data as ScheduleMatchInsert)
        .select()
        .single();
      if (error) throw error;
      return toUI(data);
    }, fromSupabaseError);
  },

  async update(id: string, payload: ScheduleMatchUpdateInput): Promise<ApiResult<ScheduleMatchUI>> {
    const parsed = scheduleMatchUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.issues));
    }
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('schedule_matches')
        .update(parsed.data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return toUI(data);
    }, fromSupabaseError);
  },

  async remove(id: string): Promise<ApiResult<void>> {
    return tryCatch(async () => {
      const { error } = await supabase.from('schedule_matches').delete().eq('id', id);
      if (error) throw error;
    }, fromSupabaseError);
  },

  // --- Bulk pin/code ---

  /**
   * Aktualisiert PIN und/oder Code für mehrere Spiele in einem Batch.
   * Jedes Update läuft als einzelnes PATCH – bei Teilfehlern werden erfolgreiche
   * Einträge in `updated` und fehlgeschlagene in `failed` zurückgegeben.
   */
  async bulkUpdatePinCode(
    input: BulkPinCodeInput,
  ): Promise<ApiResult<{ updated: string[]; failed: Array<{ id: string; message: string }> }>> {
    const parsed = bulkPinCodeSchema.safeParse(input);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.issues));
    }

    const updated: string[] = [];
    const failed: Array<{ id: string; message: string }> = [];

    await Promise.allSettled(
      parsed.data.map(async (entry) => {
        const patch: Record<string, string | null> = {};
        if (entry.pin !== undefined) patch.pin = entry.pin ?? null;
        if (entry.code !== undefined) patch.code = entry.code ?? null;
        if (Object.keys(patch).length === 0) return;

        const { error } = await supabase
          .from('schedule_matches')
          .update(patch)
          .eq('id', entry.id);

        if (error) {
          failed.push({ id: entry.id, message: error.message });
        } else {
          updated.push(entry.id);
        }
      }),
    );

    return ok({ updated, failed });
  },

  // --- click-TT Import ---

  /**
   * Importiert normalisierte click-TT-Zeilen in die DB.
   *
   * @param rows          Rohe click-TT-Export-Zeilen (Array of plain objects)
   * @param teamId        UUID der Mannschaft
   * @param seasonId      UUID der Saison
   * @param clubTeamName  Vereinsname für Home/Away-Derivation
   * @param skipDuplicates Wenn true, werden bereits vorhandene match_day+team_id-Kombos übersprungen
   */
  async importFromClickTT(
    rows: unknown[],
    teamId: string,
    seasonId: string,
    seasonPhaseId: string,
    clubTeamName: string,
    skipDuplicates = true,
  ): Promise<
    ApiResult<{
      inserted: number;
      skipped: number;
      parseErrors: Array<{ rowIndex: number; message: string }>;
    }>
  > {
    const { imported, errors: parseErrors } = normalizeClickTTRows(
      rows,
      teamId,
      seasonId,
      seasonPhaseId,
      clubTeamName,
    );

    if (imported.length === 0) {
      return ok({ inserted: 0, skipped: 0, parseErrors });
    }

    let toInsert = imported.map((r) => r.match);
    let skipped = 0;

    if (skipDuplicates) {
      // Vorhandene Spieltage für diese Mannschaft/Saison laden
      const { data: existing } = await supabase
        .from('schedule_matches')
        .select('match_day')
        .eq('team_id', teamId)
        .eq('season_phase_id', seasonPhaseId);

      const existingDays = new Set((existing ?? []).map((r) => r.match_day));
      const before = toInsert.length;
      toInsert = toInsert.filter((m) => m.match_day == null || !existingDays.has(m.match_day));
      skipped = before - toInsert.length;
    }

    if (toInsert.length === 0) {
      return ok({ inserted: 0, skipped, parseErrors });
    }

    return tryCatch(async () => {
      const { error } = await supabase.from('schedule_matches').insert(toInsert);
      if (error) throw error;
      return { inserted: toInsert.length, skipped, parseErrors };
    }, fromSupabaseError);
  },
};
