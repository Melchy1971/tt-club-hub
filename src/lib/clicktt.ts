/**
 * click-TT CSV Import – Pure Parsing-Funktionen
 *
 * click-TT ist das Online-Ergebnismeldungssystem des DTTB.
 * Spielpläne können als CSV exportiert werden. Dieses Modul
 * normalisiert den Export auf das interne Datenmodell.
 *
 * Unterstützte Formate:
 *   - Trennzeichen: Semikolon (Standard), Komma, Tab
 *   - Datum: DD.MM.YYYY
 *   - Zeit:  HH:MM
 *   - Score: "8:2" | "-:-" | "–:–" | "" | "-"
 *   - Encoding: UTF-8 (mit oder ohne BOM)
 */

import type { MatchStatusValue } from '@/schemas/match.schema';

// ─── Öffentliche Typen ────────────────────────────────────────────────────────

/** Felder nach dem Spalten-Mapping, noch als Rohstrings. */
export interface ClickTTRawRow {
  match_day?: string;
  match_date?: string;
  match_time?: string;
  home_team?: string;
  away_team?: string;
  result?: string;
  venue_name?: string;
  pin?: string;
  code?: string;
}

/** Normalisierter Match, bereit für den DB-Insert. */
export interface NormalizedMatch {
  match_day: number | null;
  /** ISO-Datum YYYY-MM-DD */
  match_date: string;
  /** HH:MM:SS | null */
  match_time: string | null;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  is_home: boolean;
  status: MatchStatusValue;
  pin: string | null;
  code: string | null;
  /** Rohname des Spiellokals (kein venue_id). Wird für Anzeige verwendet. */
  venue_name: string | null;
}

export interface ParseRowResult {
  /** null wenn kritische Fehler vorliegen. */
  normalized: NormalizedMatch | null;
  rawValues: ClickTTRawRow;
  /** Kritische Fehler – Zeile kann nicht importiert werden. */
  errors: string[];
  /** Warnungen – Zeile wird importiert, aber Daten sollten geprüft werden. */
  warnings: string[];
  /** 0-basierter Zeilenindex (ohne Header). */
  lineIndex: number;
}

export interface ClickTTParseResult {
  rows: ParseRowResult[];
  /** Automatisch erkannte Feld-Zuordnung: colIndex → feldName. */
  fieldMapping: Record<number, string>;
  validCount: number;
  errorCount: number;
}

// ─── Interne Konstanten ───────────────────────────────────────────────────────

/**
 * Bekannte Spalten-Aliase aus click-TT-Exporten.
 * Schlüssel: normalisierter Header (lowercase, keine Umlaute, keine Sonderzeichen).
 * Wert: interner Feld-Name.
 */
const CLICKTT_ALIASES: Record<string, keyof ClickTTRawRow> = {
  // Spieltag
  spieltag:       'match_day',
  spieltagnr:     'match_day',
  spieltag_nr:    'match_day',
  st:             'match_day',
  runde:          'match_day',
  nr:             'match_day',
  nr_:            'match_day',
  lfd_nr:         'match_day',
  // Datum
  datum:          'match_date',
  spieltermin:    'match_date',
  spieltag_datum: 'match_date',
  // Uhrzeit
  uhrzeit:        'match_time',
  zeit:           'match_time',
  beginn:         'match_time',
  anwurf:         'match_time',
  // Heimmannschaft
  heimmannschaft: 'home_team',
  heim:           'home_team',
  gastgeber:      'home_team',
  heimverein:     'home_team',
  // Gastmannschaft
  gastmannschaft: 'away_team',
  gast:           'away_team',
  auswaerts:      'away_team',
  auswarts:       'away_team',
  gastverin:      'away_team',
  gastverein:     'away_team',
  // Ergebnis
  ergebnis:       'result',
  resultat:       'result',
  endstand:       'result',
  // Spiellokal
  spiellokal:     'venue_name',
  halle:          'venue_name',
  spielstatte:    'venue_name',
  spielstaette:   'venue_name',
  spielhalle:     'venue_name',
  ort:            'venue_name',
  // PIN / Zugangscode
  pin:            'pin',
  zugangscode:    'pin',
  // Begegnungscode / -nummer
  begegnungscode: 'code',
  begegnungsnr:   'code',
  begegnungsnummer: 'code',
  begegnungskennung: 'code',
  code:           'code',
  begegnungsid:   'code',
  kennung:        'code',
};

// Spalten, die wir gezielt überspringen (nicht als unknown warnen)
const KNOWN_SKIP_COLUMNS = new Set([
  'wochentag', 'tag', 'spieltag_wochentag', 'kommentar',
  'info', 'hinweis', 'anmerkung', 'status',
]);

// ─── Hilfsfunktionen (intern) ─────────────────────────────────────────────────

/**
 * Normalisiert einen CSV-Header für den Alias-Vergleich.
 * - Lowercase
 * - Umlaute ersetzen (ä→a, ö→o, ü→u, ß→ss)
 * - Alles außer [a-z0-9] durch _ ersetzen
 * - Mehrfache _ zusammenführen, führende/abschließende entfernen
 */
function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Erkennt das CSV-Trennzeichen anhand der ersten Zeile.
 * click-TT verwendet meistens Semikolon.
 */
function detectSeparator(firstLine: string): string {
  const counts: Record<string, number> = {
    ';': (firstLine.match(/;/g) ?? []).length,
    ',': (firstLine.match(/,/g) ?? []).length,
    '\t': (firstLine.match(/\t/g) ?? []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Parst eine einzelne CSV-Zeile.
 * Unterstützt doppelt-gequotete Felder mit internen Quotes ("").
 */
function parseCsvLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (line.startsWith(sep, i)) { result.push(current.trim()); current = ''; i += sep.length - 1; }
      else { current += ch; }
    }
  }
  result.push(current.trim());
  return result;
}

// ─── Öffentliche Parsing-Funktionen ──────────────────────────────────────────

/**
 * Erkennt das Feld-Mapping aus CSV-Headern.
 *
 * @returns Map: colIndex → internes Feld (z.B. 'match_date')
 */
export function autoMapClickTTHeaders(
  headers: string[],
): Record<number, keyof ClickTTRawRow> {
  const mapping: Record<number, keyof ClickTTRawRow> = {};
  const used = new Set<keyof ClickTTRawRow>();

  headers.forEach((h, i) => {
    const norm = normalizeHeader(h);
    const field = CLICKTT_ALIASES[norm];
    if (field && !used.has(field)) {
      mapping[i] = field;
      used.add(field);
    }
  });
  return mapping;
}

/**
 * Parst ein Datum in das Format YYYY-MM-DD.
 * Unterstützt DD.MM.YYYY und YYYY-MM-DD.
 *
 * @returns ISO-Datum oder null wenn ungültig.
 */
export function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  // DD.MM.YYYY (click-TT Standard)
  const de = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (de) {
    const [, d, m, y] = de;
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    // Grundprüfung ob Datum valide ist
    if (!isNaN(Date.parse(iso))) return iso;
    return null;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && !isNaN(Date.parse(trimmed))) {
    return trimmed;
  }
  return null;
}

/**
 * Normalisiert eine Uhrzeit auf HH:MM:SS für den DB-Speicher.
 * Eingabe: HH:MM oder HH:MM:SS
 *
 * @returns "HH:MM:SS" oder null wenn ungültig.
 */
export function parseTime(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/**
 * Parst ein Ergebnis-Feld aus click-TT.
 * Unterstützt: "8:2", "8 : 2", "-:-", "–:–", "", "-"
 *
 * @returns {home, away} beide null = kein Ergebnis.
 */
export function parseScore(raw: string): { home: number | null; away: number | null } {
  const trimmed = raw.trim().replace(/–/g, '-').replace(/\s/g, '');
  if (!trimmed || trimmed === '-:-' || trimmed === '-' || trimmed === '--') {
    return { home: null, away: null };
  }
  const m = trimmed.match(/^(\d+)[:\-](\d+)$/);
  if (!m) return { home: null, away: null };
  return { home: parseInt(m[1], 10), away: parseInt(m[2], 10) };
}

/**
 * Leitet `is_home` aus Heim/Gast-Texten und dem Team-Namen ab.
 *
 * Algorithmus (Priorität absteigend):
 *  1. Exakter Vergleich (case-insensitive, normiert)
 *  2. Enthaltenseins-Prüfung (home_team enthält teamName oder umgekehrt)
 *
 * Robustheit: Tischtennis-Vereinsnamen enthalten oft Suffix "I", "II" oder
 * Jahreszahlen. Die Kurzform wird nach 3 Zeichen als Präfix verglichen.
 *
 * @param ourTeamName - Name der eigenen Mannschaft (aus `teams.name`)
 * @param homeTeamText - Feld „Heimmannschaft" aus dem click-TT Export
 * @returns true wenn die eigene Mannschaft das Heimspiel hat.
 */
export function deriveIsHome(ourTeamName: string, homeTeamText: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const a = normalize(ourTeamName);
  const b = normalize(homeTeamText);

  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  // Präfix-Vergleich (mind. 5 Zeichen) für abgekürzte Vereinsnamen
  const minLen = 5;
  if (a.length >= minLen && b.length >= minLen) {
    const prefix = a.slice(0, Math.min(a.length, b.length) - 2);
    if (prefix.length >= minLen && b.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Leitet den Match-Status aus vorhandenen Scores ab.
 *  - Beide Scores gesetzt → 'beendet'
 *  - Keine Scores       → 'geplant'
 *
 * Falls der Rohstatus aus click-TT bekannt ist (z.B. "verlegt"),
 * kann er als `rawStatus` übergeben werden.
 */
export function deriveStatus(
  home_score: number | null,
  away_score: number | null,
  rawStatus?: string,
): MatchStatusValue {
  if (home_score != null && away_score != null) return 'beendet';

  if (rawStatus) {
    const norm = rawStatus.toLowerCase().trim();
    if (norm.includes('verschob') || norm.includes('verlegt')) return 'verschoben';
    if (norm.includes('abgesagt') || norm.includes('abgeset') || norm.includes('cancel')) return 'abgesagt';
    if (norm.includes('laufend') || norm.includes('aktuell')) return 'laufend';
  }
  return 'geplant';
}

/**
 * Parst eine einzelne click-TT CSV-Daten-Zeile.
 *
 * @param raw - Rohfelder nach dem Spalten-Mapping
 * @param ourTeamName - Name der eigenen Mannschaft (für is_home-Derivation)
 * @param lineIndex - 0-basierter Zeilenindex für Fehlermeldungen
 */
export function parseClickTTRow(
  raw: ClickTTRawRow,
  ourTeamName: string,
  lineIndex: number,
): ParseRowResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ── Datum (Pflichtfeld) ──
  let match_date: string | null = null;
  if (!raw.match_date?.trim()) {
    errors.push('Datum fehlt');
  } else {
    match_date = parseDate(raw.match_date);
    if (!match_date) errors.push(`Ungültiges Datum: „${raw.match_date}" (erwartet DD.MM.YYYY)`);
  }

  // ── Heimmannschaft (Pflichtfeld) ──
  const home_team = raw.home_team?.trim();
  if (!home_team) errors.push('Heimmannschaft fehlt');

  // ── Gastmannschaft (Pflichtfeld) ──
  const away_team = raw.away_team?.trim();
  if (!away_team) errors.push('Gastmannschaft fehlt');

  // Früher Abbruch bei kritischen Fehlern
  if (errors.length > 0) {
    return { normalized: null, rawValues: raw, errors, warnings, lineIndex };
  }

  // ── Spieltag ──
  let match_day: number | null = null;
  if (raw.match_day?.trim()) {
    const n = parseInt(raw.match_day.trim(), 10);
    if (isNaN(n) || n < 1 || n > 99) warnings.push(`Ungültiger Spieltag: „${raw.match_day}"`);
    else match_day = n;
  }

  // ── Uhrzeit ──
  let match_time: string | null = null;
  if (raw.match_time?.trim()) {
    match_time = parseTime(raw.match_time);
    if (!match_time) warnings.push(`Ungültige Uhrzeit: „${raw.match_time}" (erwartet HH:MM)`);
  }

  // ── Ergebnis / Score ──
  const { home: home_score, away: away_score } = raw.result?.trim()
    ? parseScore(raw.result)
    : { home: null, away: null };

  if (home_score !== null && home_score > 20) warnings.push(`Heim-Score ${home_score} ungewöhnlich hoch`);
  if (away_score !== null && away_score > 20) warnings.push(`Gast-Score ${away_score} ungewöhnlich hoch`);

  // ── Status ──
  const status = deriveStatus(home_score, away_score);

  // ── Heim/Auswärts ──
  const is_home = deriveIsHome(ourTeamName, home_team!);

  // ── PIN / Code ──
  const pin = raw.pin?.trim() || null;
  const code = raw.code?.trim() || null;

  // ── Spiellokal ──
  const venue_name = raw.venue_name?.trim() || null;

  const normalized: NormalizedMatch = {
    match_day,
    match_date: match_date!,
    match_time,
    home_team: home_team!,
    away_team: away_team!,
    home_score,
    away_score,
    is_home,
    status,
    pin,
    code,
    venue_name,
  };

  return { normalized, rawValues: raw, errors, warnings, lineIndex };
}

/**
 * Parst einen vollständigen click-TT CSV-Export.
 *
 * @param csvText - Roher CSV-Inhalt (UTF-8, BOM wird entfernt)
 * @param ourTeamName - Name der eigenen Mannschaft für is_home-Derivation
 * @returns ParseResult mit allen Zeilen und Statistiken
 */
export function parseClickTTCsv(
  csvText: string,
  ourTeamName: string,
): ClickTTParseResult {
  // BOM entfernen
  const text = csvText.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { rows: [], fieldMapping: {}, validCount: 0, errorCount: 0 };
  }

  const sep = detectSeparator(lines[0]);
  const rawHeaders = parseCsvLine(lines[0], sep);
  const fieldMapping = autoMapClickTTHeaders(rawHeaders);

  // Warne über unbekannte Spalten (nicht in fieldMapping, nicht in KNOWN_SKIP_COLUMNS)
  const unmapped = rawHeaders
    .map((h, i) => ({ h, i }))
    .filter(({ h, i }) => {
      const norm = normalizeHeader(h);
      return !(i in fieldMapping) && !KNOWN_SKIP_COLUMNS.has(norm);
    })
    .map(({ h }) => h);

  const rows: ParseRowResult[] = lines.slice(1).map((line, lineIndex) => {
    const cells = parseCsvLine(line, sep);
    const raw: ClickTTRawRow = {};

    Object.entries(fieldMapping).forEach(([colIdx, field]) => {
      const val = cells[Number(colIdx)];
      if (val !== undefined) (raw as Record<string, string>)[field] = val;
    });

    const result = parseClickTTRow(raw, ourTeamName, lineIndex);

    if (unmapped.length > 0 && lineIndex === 0) {
      result.warnings.push(
        `Nicht erkannte Spalten (ignoriert): ${unmapped.slice(0, 5).join(', ')}${unmapped.length > 5 ? ` …+${unmapped.length - 5}` : ''}`,
      );
    }
    return result;
  });

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.filter((r) => r.errors.length > 0).length;

  return { rows, fieldMapping, validCount, errorCount };
}
