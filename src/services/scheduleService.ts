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
  vereinsspielplanRowSchema,
  matchResultUpdateSchema,
  type ScheduleMatchCreateInput,
  type ScheduleMatchUpdateInput,
  type ScheduleMatchFilterInput,
  type BulkPinCodeInput,
  type ClickTTRow,
  type VereinsspielplanRow,
  type MatchResultUpdateInput,
} from '@/schemas/schedule.schema';

const resolveSeasonCycleIdByPhaseId = async (seasonPhaseId: string): Promise<string> => {
  const { data, error } = await supabase
    .from('season_phases')
    .select('season_cycle_id')
    .eq('id', seasonPhaseId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.season_cycle_id) throw new Error('season_phase_id not found');
  return data.season_cycle_id;
};

// ─── UI-Typ ────────────────────────────────────────────────────────────────────

export interface ScheduleMatchUI {
  id: string;
  seasonCycleId: string;
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
    seasonCycleId: row.season_id,
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

// ─── Vereinsspielplan-Normalisierung ────────────────────────────────────────────

/**
 * Parst "DD.MM.YYYY HH:MM" aus dem Termin-Feld.
 * Gibt { date: "YYYY-MM-DD", time: "HH:MM" } zurück.
 */
export function parseTermin(raw: string): { date: string; time: string | null } | null {
  const trimmed = raw.trim();
  // "DD.MM.YYYY HH:MM"
  const m = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (m) {
    const [, d, mo, y, h, min] = m;
    return {
      date: `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`,
      time: `${h.padStart(2, '0')}:${min}`,
    };
  }
  // Fallback: nur Datum ohne Zeit
  const dateOnly = parseGermanDate(trimmed);
  if (dateOnly) return { date: dateOnly, time: null };
  return null;
}

/**
 * Leitet die Runde (VR/RR/Pokal) in einen phase_type-kompatiblen Wert ab.
 * VR → first_half, RR → second_half, Pokal/sonstige → null (kein Phase-Mapping)
 */
export function mapRundeToPhaseType(runde: string): 'first_half' | 'second_half' | null {
  const normalized = runde.trim().toUpperCase();
  if (normalized === 'VR') return 'first_half';
  if (normalized === 'RR') return 'second_half';
  return null;
}

export interface VereinsspielplanImportRow {
  rowIndex: number;
  match: ScheduleMatchInsert;
  staffel: string;
  runde: string;
}

export interface VereinsspielplanImportResult {
  imported: VereinsspielplanImportRow[];
  errors: Array<{ rowIndex: number; message: string }>;
}

/**
 * Normalisiert rohe Vereinsspielplan-CSV-Zeilen zu Import-Objekten.
 *
 * @param rows          Rohdaten aus dem CSV-Import (Array von Objekten)
 * @param teamId        UUID der Mannschaft
 * @param seasonId      UUID der Saison
 * @param seasonPhaseId UUID der Saisonphase
 * @param clubName      Vereinsname für Heim/Auswärts-Erkennung (z.B. "TTC Zaberfeld")
 */
export function normalizeVereinsspielplanRows(
  rows: unknown[],
  teamId: string,
  seasonId: string,
  seasonPhaseId: string,
  clubName: string,
): VereinsspielplanImportResult {
  const imported: VereinsspielplanImportRow[] = [];
  const rowErrors: Array<{ rowIndex: number; message: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const parsed = vereinsspielplanRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      rowErrors.push({
        rowIndex: i,
        message: parsed.error.issues.map((iss) => iss.message).join('; '),
      });
      continue;
    }

    const row: VereinsspielplanRow = parsed.data;

    // "spielfrei"-Einträge überspringen
    const homeNorm = row.HeimMannschaft.trim().toLowerCase();
    const awayNorm = row.GastMannschaft.trim().toLowerCase();
    if (homeNorm === 'spielfrei' || awayNorm === 'spielfrei') {
      continue;
    }

    const terminParsed = parseTermin(row.Termin);
    if (!terminParsed) {
      rowErrors.push({ rowIndex: i, message: `Ungültiger Termin: "${row.Termin}"` });
      continue;
    }

    const isHome = deriveIsHome(row.HeimMannschaft, clubName);

    const insert: ScheduleMatchInsert = {
      team_id: teamId,
      season_id: seasonId,
      season_phase_id: seasonPhaseId,
      match_day: null,
      match_date: terminParsed.date,
      match_time: terminParsed.time,
      home_team: row.HeimMannschaft.trim(),
      away_team: row.GastMannschaft.trim(),
      is_home: isHome,
      home_score: null,
      away_score: null,
      status: 'geplant',
    };

    imported.push({
      rowIndex: i,
      match: insert,
      staffel: row.Staffel,
      runde: row.Runde,
    });
  }

  return { imported, errors: rowErrors };
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

// ─── Duplikaterkennung ─────────────────────────────────────────────────────────

/**
 * Erzeugt einen Deduplizierungs-Schlüssel für ein Spiel.
 * Kombination aus Datum + Heim + Auswärts identifiziert ein Spiel eindeutig.
 */
function matchDedupKey(m: { match_date: string; home_team: string; away_team: string }): string {
  return `${m.match_date}::${m.home_team.toLowerCase().trim()}::${m.away_team.toLowerCase().trim()}`;
}

// ─── Service ───────────────────────────────────────────────────────────────────

export const scheduleService = {
  // --- Queries ---

  async list(filter: ScheduleMatchFilterInput = {}): Promise<ApiResult<ScheduleMatchUI[]>> {
    const parsed = scheduleMatchFilterSchema.safeParse(filter);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.issues));
    }
    const { team_id, season_cycle_id, season_id, season_phase_id, active_phase, status, is_home, from_date, to_date, match_day } = parsed.data;

    return tryCatch(async () => {
      let selectStr = '*';
      if (active_phase) {
        selectStr = '*, season_phases!inner(id, is_active)';
      }

      let q = supabase.from('schedule_matches').select(selectStr);
      if (team_id)    q = q.eq('team_id', team_id);
      const cycleId = season_cycle_id ?? season_id;
      if (cycleId)  q = q.eq('season_id', cycleId);
      if (season_phase_id) q = q.eq('season_phase_id', season_phase_id);
      if (active_phase) {
        q = q.eq('season_phases.is_active' as any, true);
      }
      if (status)     q = q.eq('status', status);
      if (is_home != null) q = q.eq('is_home', is_home);
      if (from_date)  q = q.gte('match_date', from_date);
      if (to_date)    q = q.lte('match_date', to_date);
      if (match_day)  q = q.eq('match_day', match_day);

      const { data, error } = await q.order('match_date').order('match_time', { nullsFirst: false });
      if (error) throw error;
      return sortMatches((data ?? []).map((row: any) => {
        const { season_phases: _sp, ...match } = row;
        return toUI(match as ScheduleMatch);
      }));
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

  async getRecent(teamId: string, limit = 5): Promise<ApiResult<ScheduleMatchUI[]>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('schedule_matches')
        .select('*')
        .eq('team_id', teamId)
        .eq('status', 'beendet')
        .order('match_date', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map(toUI);
    }, fromSupabaseError);
  },

  // --- Statistiken ---

  async getTeamStats(teamId: string, seasonPhaseId?: string): Promise<ApiResult<{
    total: number;
    wins: number;
    losses: number;
    draws: number;
    pending: number;
    winRate: number;
  }>> {
    return tryCatch(async () => {
      let q = supabase
        .from('schedule_matches')
        .select('home_score, away_score, is_home, status')
        .eq('team_id', teamId);
      if (seasonPhaseId) q = q.eq('season_phase_id', seasonPhaseId);

      const { data, error } = await q;
      if (error) throw error;

      const matches = data ?? [];
      let wins = 0, losses = 0, draws = 0, pending = 0;

      for (const m of matches) {
        if (m.status !== 'beendet' || m.home_score == null || m.away_score == null) {
          pending++;
          continue;
        }
        const ownScore = m.is_home ? m.home_score : m.away_score;
        const oppScore = m.is_home ? m.away_score : m.home_score;
        if (ownScore > oppScore) wins++;
        else if (ownScore < oppScore) losses++;
        else draws++;
      }

      const completed = wins + losses + draws;
      return {
        total: matches.length,
        wins,
        losses,
        draws,
        pending,
        winRate: completed > 0 ? Math.round((wins / completed) * 100) : 0,
      };
    }, fromSupabaseError);
  },

  // --- Mutationen ---

  async create(payload: ScheduleMatchCreateInput): Promise<ApiResult<ScheduleMatchUI>> {
    const parsed = scheduleMatchCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.issues));
    }
    return tryCatch(async () => {
      const cycleId = parsed.data.season_cycle_id
        ?? parsed.data.season_id
        ?? await resolveSeasonCycleIdByPhaseId(parsed.data.season_phase_id);
      const { season_cycle_id: _seasonCycleId, ...payload } = parsed.data;
      const { data, error } = await supabase
        .from('schedule_matches')
        .insert({ ...payload, season_id: cycleId } as ScheduleMatchInsert)
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
      const patch: Record<string, unknown> = { ...parsed.data };
      if (patch.season_cycle_id && !patch.season_id) patch.season_id = patch.season_cycle_id;
      delete patch.season_cycle_id;
      const { data, error } = await supabase
        .from('schedule_matches')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return toUI(data);
    }, fromSupabaseError);
  },

  /** Ergebnis eines Spiels setzen (inkl. Status → beendet). */
  async updateResult(id: string, payload: MatchResultUpdateInput): Promise<ApiResult<ScheduleMatchUI>> {
    const parsed = matchResultUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.issues));
    }
    return tryCatch(async () => {
      const patch = {
        home_score: parsed.data.home_score,
        away_score: parsed.data.away_score,
        status: parsed.data.status ?? ('beendet' as const),
        ...(parsed.data.report_text !== undefined ? { report_text: parsed.data.report_text } : {}),
      };
      const { data, error } = await supabase
        .from('schedule_matches')
        .update(patch)
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
      rows, teamId, seasonId, seasonPhaseId, clubTeamName,
    );

    if (imported.length === 0) {
      return ok({ inserted: 0, skipped: 0, parseErrors });
    }

    let toInsert = imported.map((r) => r.match);
    let skipped = 0;

    if (skipDuplicates) {
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

  // --- Vereinsspielplan Import ---

  /**
   * Importiert Vereinsspielplan-CSV-Zeilen (Format: Termin;Wochentag;Staffel;Runde;HalleNr;HeimMannschaft;GastMannschaft).
   *
   * Duplikaterkennung basiert auf Datum + Heimmannschaft + Gastmannschaft.
   *
   * @param rows          Rohdaten aus dem CSV (Array von Objekten mit Spaltenheadern als Keys)
   * @param teamId        UUID der Mannschaft
   * @param seasonId      UUID der Saison
   * @param seasonPhaseId UUID der Saisonphase
   * @param clubName      Vereinsname für Heim/Auswärts-Erkennung (z.B. "TTC Zaberfeld")
   * @param skipDuplicates Wenn true, werden bereits vorhandene Spiele übersprungen
   */
  async importFromVereinsspielplan(
    rows: unknown[],
    teamId: string,
    seasonId: string,
    seasonPhaseId: string,
    clubName: string,
    skipDuplicates = true,
  ): Promise<
    ApiResult<{
      inserted: number;
      skipped: number;
      parseErrors: Array<{ rowIndex: number; message: string }>;
      staffelInfo: string[];
    }>
  > {
    const { imported, errors: parseErrors } = normalizeVereinsspielplanRows(
      rows, teamId, seasonId, seasonPhaseId, clubName,
    );

    // Sammle eindeutige Staffeln für Info
    const staffelInfo = Array.from(new Set(imported.map((r) => r.staffel)));

    if (imported.length === 0) {
      return ok({ inserted: 0, skipped: 0, parseErrors, staffelInfo });
    }

    let toInsert = imported.map((r) => r.match);
    let skipped = 0;

    if (skipDuplicates) {
      const { data: existing } = await supabase
        .from('schedule_matches')
        .select('match_date, home_team, away_team')
        .eq('team_id', teamId)
        .eq('season_phase_id', seasonPhaseId);

      const existingKeys = new Set(
        (existing ?? []).map((r) => matchDedupKey(r)),
      );

      const before = toInsert.length;
      toInsert = toInsert.filter((m) => !existingKeys.has(matchDedupKey(m)));
      skipped = before - toInsert.length;
    }

    if (toInsert.length === 0) {
      return ok({ inserted: 0, skipped, parseErrors, staffelInfo });
    }

    return tryCatch(async () => {
      const { error } = await supabase.from('schedule_matches').insert(toInsert);
      if (error) throw error;
      return { inserted: toInsert.length, skipped, parseErrors, staffelInfo };
    }, fromSupabaseError);
  },
};
