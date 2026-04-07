import type { ImportIssue, ImportIssueCode, RowImportResult, RowStatus } from '@/import/types';

export type SchedulePhaseType = 'first_half' | 'second_half' | 'single_half';

export interface ScheduleMatchNormalized {
  date: string | null;
  time: string | null;
  isHome: boolean | null;
  opponent: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  league: string | null;
  venue: string | null;
  pin: string | null;
  code: string | null;
  seasonPhase: SchedulePhaseType | null;
  sourceFingerprint: string;
}

export interface ScheduleParserOptions {
  clubName?: string;
  source?: 'csv' | 'excel' | 'click-tt';
}

export interface ScheduleParserReport {
  rows: Array<RowImportResult<ScheduleMatchNormalized>>;
  duplicates: Array<{ rowIndex: number; duplicateOfRowIndex: number }>;
  issues: ImportIssue[];
}

type CanonicalField =
  | 'date'
  | 'time'
  | 'homeTeam'
  | 'awayTeam'
  | 'isHome'
  | 'opponent'
  | 'league'
  | 'venue'
  | 'pin'
  | 'code'
  | 'seasonPhase'
  | 'round';

const aliases: Record<CanonicalField, string[]> = {
  date: ['date', 'datum', 'termin', 'spieltermin'],
  time: ['time', 'uhrzeit', 'beginn'],
  homeTeam: ['home_team', 'heim', 'heimmannschaft', 'heimmannschaft'],
  awayTeam: ['away_team', 'gast', 'gastmannschaft'],
  isHome: ['is_home', 'heim_auswaerts', 'heim/auswaerts', 'heim_auswärts'],
  opponent: ['opponent', 'gegner'],
  league: ['league', 'liga', 'staffel', 'klasse'],
  venue: ['venue', 'spielort', 'halle', 'hallenr', 'hallenummer'],
  pin: ['pin'],
  code: ['code'],
  seasonPhase: ['season_phase', 'saisonphase'],
  round: ['runde', 'phase'],
};

const normalizeKey = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');

const getField = (row: Record<string, unknown>, field: CanonicalField): unknown => {
  const byAlias = aliases[field]
    .map((alias) => row[alias] ?? row[normalizeKey(alias)])
    .find((value) => value !== undefined && value !== null && String(value).trim() !== '');
  return byAlias;
};

const toText = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

const parseDate = (value: unknown): { date: string | null; issue?: ImportIssue } => {
  const text = toText(value);
  if (!text) {
    return { date: null, issue: makeIssue('MISSING_REQUIRED_FIELD', 'warning', 'Datum fehlt', 'date', value) };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return { date: text };

  const german = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (german) {
    return { date: `${german[3]}-${german[2].padStart(2, '0')}-${german[1].padStart(2, '0')}` };
  }

  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    return {
      date: null,
      issue: makeIssue('AMBIGUOUS_DATE', 'warning', `Mehrdeutiges Datum "${text}"`, 'date', value),
    };
  }

  return { date: null, issue: makeIssue('INVALID_DATE', 'error', `Ungültiges Datum "${text}"`, 'date', value) };
};

const parseTime = (value: unknown): string | null => {
  const text = toText(value);
  if (!text) return null;
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
};

const parseHomeFlag = (value: unknown): boolean | null => {
  const text = toText(value);
  if (!text) return null;
  const norm = normalizeKey(text);
  if (['heim', 'home', 'h', '1', 'true'].includes(norm)) return true;
  if (['auswaerts', 'auswarts', 'away', 'a', '0', 'false', 'gast'].includes(norm)) return false;
  return null;
};

const normalizeTeam = (value: unknown): string | null => toText(value);

const inferPhase = (league: string | null, seasonPhase: string | null, round: string | null): SchedulePhaseType | null => {
  const joined = [league, seasonPhase, round].filter(Boolean).join(' ').toLowerCase();
  if (!joined) return null;
  if (joined.includes('jugend')) return 'single_half';
  if (joined.includes('vorrunde') || /\bvr\b/.test(joined)) return 'first_half';
  if (joined.includes('rückrunde') || joined.includes('rueckrunde') || /\brr\b/.test(joined)) return 'second_half';
  return null;
};

const dedupKey = (row: ScheduleMatchNormalized): string => {
  return [row.date ?? '', row.homeTeam ?? '', row.awayTeam ?? '', row.time ?? ''].map((v) => normalizeKey(v)).join('::');
};

const makeIssue = (
  code: ImportIssueCode,
  severity: ImportIssue['severity'],
  message: string,
  field?: string,
  rawValue?: unknown,
): ImportIssue => ({ code, severity, message, field, rawValue });

export const parseScheduleMatches = (
  rows: unknown[],
  options: ScheduleParserOptions = {},
): ScheduleParserReport => {
  const report: ScheduleParserReport = { rows: [], duplicates: [], issues: [] };
  const dedupMap = new Map<string, number>();

  rows.forEach((rawRow, rowIndex) => {
    const row = (rawRow ?? {}) as Record<string, unknown>;
    const issues: ImportIssue[] = [];

    const parsedDate = parseDate(getField(row, 'date'));
    if (parsedDate.issue) issues.push(parsedDate.issue);

    const time = parseTime(getField(row, 'time'));
    const homeTeam = normalizeTeam(getField(row, 'homeTeam'));
    const awayTeam = normalizeTeam(getField(row, 'awayTeam'));

    let isHome = parseHomeFlag(getField(row, 'isHome'));
    const clubNameNorm = normalizeKey(options.clubName ?? '');
    if (isHome === null && clubNameNorm) {
      const homeNorm = normalizeKey(homeTeam ?? '');
      const awayNorm = normalizeKey(awayTeam ?? '');
      if (homeNorm && homeNorm.includes(clubNameNorm)) isHome = true;
      else if (awayNorm && awayNorm.includes(clubNameNorm)) isHome = false;
    }

    const opponent = normalizeTeam(getField(row, 'opponent'))
      ?? (isHome === true ? awayTeam : isHome === false ? homeTeam : null);

    const league = toText(getField(row, 'league'));
    const venue = toText(getField(row, 'venue'));
    const pin = toText(getField(row, 'pin'));
    const code = toText(getField(row, 'code'));

    const phase = inferPhase(
      league,
      toText(getField(row, 'seasonPhase')),
      toText(getField(row, 'round')),
    );

    if (!homeTeam || !awayTeam) {
      issues.push(makeIssue('MISSING_REQUIRED_FIELD', 'error', 'Heim- oder Gastmannschaft fehlt', 'home_team'));
    }

    if (isHome === null) {
      issues.push(makeIssue('LOW_CONFIDENCE_MATCH', 'warning', 'Heim/Auswärts konnte nicht eindeutig bestimmt werden', 'is_home'));
    }

    if (!phase) {
      issues.push(makeIssue('UNRESOLVED_REFERENCE', 'warning', 'season_phase konnte nicht abgeleitet werden', 'season_phase'));
    }

    const normalized: ScheduleMatchNormalized = {
      date: parsedDate.date,
      time,
      isHome,
      opponent,
      homeTeam,
      awayTeam,
      league,
      venue,
      pin,
      code,
      seasonPhase: phase,
      sourceFingerprint: '',
    };

    normalized.sourceFingerprint = dedupKey(normalized);

    const duplicateOf = dedupMap.get(normalized.sourceFingerprint);
    if (duplicateOf !== undefined) {
      report.duplicates.push({ rowIndex, duplicateOfRowIndex: duplicateOf });
      issues.push(makeIssue('DUPLICATE_RECORD', 'warning', `Duplikat zu Zeile ${duplicateOf + 1}`));
    } else {
      dedupMap.set(normalized.sourceFingerprint, rowIndex);
    }

    const hasError = issues.some((issue) => issue.severity === 'error' || issue.severity === 'fatal');
    const status: RowStatus = hasError ? 'failed' : issues.length > 0 ? 'partial' : 'success';

    const rowResult: RowImportResult<ScheduleMatchNormalized> = {
      rowIndex,
      entityType: 'match',
      status,
      draft: normalized,
      issues,
    };

    report.rows.push(rowResult);
    report.issues.push(...issues.map((issue) => ({ ...issue, rowIndex })));
  });

  return report;
};
