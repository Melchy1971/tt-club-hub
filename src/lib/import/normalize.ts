/**
 * Normalisierung eingehender Import-Daten
 *
 * Aufgaben:
 *   - Datumsformate → ISO (YYYY-MM-DD)
 *   - Zeitformate → HH:MM
 *   - Gender-Strings → DB-Enum ('maennlich' | 'weiblich' | 'divers')
 *   - Boolean-Strings → boolean
 *   - Zahlen (TTR, Spieltagsnummer)
 *   - click-TT-Ergebnis "9:3" → { homeScore, awayScore }
 *   - Mannschaftsnamen bereinigen (für Matching)
 *
 * Alle Funktionen geben null zurück, wenn der Eingabewert nicht interpretierbar ist.
 * Der Caller entscheidet, ob null ein Fehler oder ein leeres Feld bedeutet.
 */

import type { ParsedResult, NormalizedRow, RawRow, ImportSchemaType } from './types';
import { applyColumnMap } from './detect';
import type { ColumnMap } from './types';

// ── Datum ─────────────────────────────────────────────────────

/**
 * Parsiert Datumsstrings in verschiedenen Formaten → ISO (YYYY-MM-DD).
 *
 * Unterstützte Formate:
 *   DD.MM.YYYY          (click-TT, deutsches Standard)
 *   DD.MM.YY            (zweistelliges Jahr → +2000 wenn < 50, sonst +1900)
 *   YYYY-MM-DD          (ISO, Durchleitung)
 *   MM/DD/YYYY          (US-Format)
 *   DD/MM/YYYY          (britisches Format)
 *   YYYY.MM.DD          (seltene Alternative)
 *   Excel-Seriennummer  (Zahl zwischen 1 und 2958465)
 */
export function parseDate(raw: string | number | null | undefined): string | null {
  if (raw == null || raw === '') return null;

  // Excel-Seriennummer (z. B. 45291 = 2024-01-01)
  if (typeof raw === 'number' || /^\d{5}$/.test(String(raw).trim())) {
    const n = typeof raw === 'number' ? raw : parseInt(raw, 10);
    if (n > 25569 && n < 2958465) {
      // Excel epoch = 1899-12-30
      const ms = (n - 25569) * 86400 * 1000;
      return new Date(ms).toISOString().slice(0, 10);
    }
  }

  const s = String(raw).trim();

  // DD.MM.YYYY oder DD.MM.YY
  const deDot = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (deDot) {
    const [, d, m, y] = deDot;
    const year = y.length === 2 ? (parseInt(y, 10) < 50 ? `20${y}` : `19${y}`) : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // YYYY-MM-DD (ISO, direkt durchleiten nach Validierung)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : s;
  }

  // MM/DD/YYYY (US)
  const usSlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usSlash) {
    const [, m, d, y] = usSlash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YYYY (britisch)
  const gbSlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (gbSlash) {
    const [, d, m, y] = gbSlash;
    // Heuristik: wenn Tag > 12 → muss DD/MM sein
    if (parseInt(d, 10) > 12) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // Ambiguous: als MM/DD behandeln (US bevorzugt)
    return `${y}-${d.padStart(2, '0')}-${m.padStart(2, '0')}`;
  }

  // YYYY.MM.DD
  const dotISO = s.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (dotISO) {
    const [, y, m, d] = dotISO;
    return `${y}-${m}-${d}`;
  }

  return null;
}

// ── Uhrzeit ───────────────────────────────────────────────────

/**
 * Normalisiert Zeitangaben → HH:MM.
 *
 * Unterstützte Formate:
 *   HH:MM           (Durchleitung)
 *   HH:MM:SS        (Sekunden abschneiden)
 *   H:MM            (führende Null ergänzen)
 *   HH.MM           (Punkt als Trennzeichen)
 *   "18 Uhr"        (ganzzählig)
 *   "6:00 PM"       (12h-Format)
 */
export function parseTime(raw: string | null | undefined): string | null {
  if (!raw || raw.trim() === '' || raw.trim() === '-') return null;
  const s = raw.trim();

  // HH:MM oder HH:MM:SS
  const colon = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (colon) {
    return `${colon[1].padStart(2, '0')}:${colon[2]}`;
  }

  // HH.MM
  const dot = s.match(/^(\d{1,2})\.(\d{2})$/);
  if (dot) {
    return `${dot[1].padStart(2, '0')}:${dot[2]}`;
  }

  // "18 Uhr" oder "18h"
  const hourOnly = s.match(/^(\d{1,2})\s*(?:uhr|h)$/i);
  if (hourOnly) {
    return `${hourOnly[1].padStart(2, '0')}:00`;
  }

  // 12h-Format "6:00 PM" / "06:00 AM"
  const h12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (h12) {
    let hour = parseInt(h12[1], 10);
    if (h12[3].toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (h12[3].toUpperCase() === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${h12[2]}`;
  }

  return null;
}

// ── Gender ────────────────────────────────────────────────────

const GENDER_MAP: Record<string, 'maennlich' | 'weiblich' | 'divers'> = {
  m:          'maennlich',
  male:       'maennlich',
  maennlich:  'maennlich',
  männlich:   'maennlich',
  mann:       'maennlich',
  herr:       'maennlich',
  '1':        'maennlich',

  w:          'weiblich',
  f:          'weiblich',
  female:     'weiblich',
  weiblich:   'weiblich',
  frau:       'weiblich',
  '2':        'weiblich',

  d:          'divers',
  divers:     'divers',
  diverse:    'divers',
  x:          'divers',
  other:      'divers',
  '3':        'divers',
};

export function parseGender(raw: string | null | undefined): 'maennlich' | 'weiblich' | 'divers' | null {
  if (!raw || raw.trim() === '') return null;
  const key = raw.trim().toLowerCase().replace(/ä/g, 'ae').replace(/ü/g, 'ue');
  return GENDER_MAP[key] ?? null;
}

// ── Boolean ───────────────────────────────────────────────────

const TRUE_VALUES  = new Set(['1', 'true', 'ja', 'yes', 'j', 'y', 'x', 'aktiv', 'active']);
const FALSE_VALUES = new Set(['0', 'false', 'nein', 'no', 'n', 'inaktiv', 'inactive', '']);

export function parseBoolean(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const s = raw.trim().toLowerCase();
  if (TRUE_VALUES.has(s))  return true;
  if (FALSE_VALUES.has(s)) return false;
  return null;
}

// ── Zahlen ────────────────────────────────────────────────────

/** Parst Ganzzahlen. Toleriert Tausender-Trennzeichen (. oder ,). */
export function parseInteger(raw: string | null | undefined): number | null {
  if (!raw || raw.trim() === '' || raw.trim() === '-') return null;
  const cleaned = raw.trim().replace(/[.,](?=\d{3})/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}

// ── click-TT Ergebnis ─────────────────────────────────────────

/**
 * Parsiert das click-TT Ergebnisfeld.
 *
 * Formate:
 *   "9:3"            → { homeScore: 9, awayScore: 3 }
 *   "9:3 n.V."       → { homeScore: 9, awayScore: 3 } (Nachvaluation/Wertung)
 *   "3:9 (Wertung)"  → { homeScore: 3, awayScore: 9, isForfeited: true }
 *   "abgesagt"       → { isPostponed: true }
 *   "-:-"            → null (noch offen)
 *   ""               → null (noch nicht gespielt)
 *
 * Im Tischtennis: max 9:0 für Mannschaft (9 Einzel + 0 Doppel bei TTBL),
 * Standardliga: max 9:0 in der Bundesliga (keine Doppel), oder max 6:0 in unteren Ligen.
 * Wir validieren nicht die max. Punktzahl (zu ligatypabhängig).
 */
export function parseMatchResult(raw: string | null | undefined): ParsedResult | null {
  if (!raw || raw.trim() === '' || raw.trim() === '-:-' || raw.trim() === '-') return null;

  const s = raw.trim();

  const isForfeited  = /wertung|forfeit/i.test(s);
  const isPostponed  = /abgesagt|verscho?ben|postponed/i.test(s);

  if (isPostponed) {
    return { homeScore: 0, awayScore: 0, raw: s, isForfeited: false, isPostponed: true };
  }

  // Ergebnismuster: optional führende Zeichen, dann X:Y
  const match = s.match(/(\d+)\s*:\s*(\d+)/);
  if (!match) return null;

  return {
    homeScore: parseInt(match[1], 10),
    awayScore: parseInt(match[2], 10),
    raw: s,
    isForfeited,
    isPostponed: false,
  };
}

// ── Mannschaftsname ───────────────────────────────────────────

/**
 * Normalisiert Mannschaftsnamen für den Vergleich (nicht für Anzeige).
 *
 * Entfernt:
 *   - Rechtsformen: e.V., e.v., eV
 *   - Führende/nachfolgende Leerzeichen
 *   - Doppelte Leerzeichen
 *   - Satzzeichen am Satzende
 * Vereinheitlicht:
 *   - Kleinbuchstaben
 *   - "1. Mannschaft" / "I" / "1" am Ende → " 1"
 *   - Umlaute → ae/oe/ue
 *
 * Diese Normalisierung ist für Matching-Zwecke, nicht für die Anzeige.
 */
export function normalizeTeamName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\be\.?\s*v\.?\b/gi, '')            // e.V.
    .replace(/\b(1|i)\b\.?\s*(mannschaft|mschaft|ms)/gi, '1')  // "1. Mannschaft"
    .replace(/\b(2|ii)\b\.?\s*(mannschaft|mschaft|ms)/gi, '2')
    .replace(/\b(3|iii)\b\.?\s*(mannschaft|mschaft|ms)/gi, '3')
    .replace(/[äöüÄÖÜ]/g, (c) => ({ ä:'ae',ö:'oe',ü:'ue',Ä:'ae',Ö:'oe',Ü:'ue' }[c] ?? c))
    .replace(/ß/g, 'ss')
    .replace(/[^\w\s\d]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Zeilen-Normalisierung ─────────────────────────────────────

/**
 * Normalisiert eine gemappte Zeile abhängig vom Schema-Typ.
 * Gibt ein Record zurück mit typisierten Werten.
 *
 * @param mapped   Ergebnis von applyColumnMap() – Record<targetField, rawString>
 * @param schema   'member' | 'schedule_match' | 'clicktt'
 */
export function normalizeFields(
  mapped: Record<string, string>,
  schema: ImportSchemaType,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...mapped }; // Rohdaten als Fallback

  if (schema === 'member') {
    if (mapped.first_name   != null) out.first_name   = mapped.first_name.trim();
    if (mapped.last_name    != null) out.last_name    = mapped.last_name.trim();
    if (mapped.email        != null) out.email        = mapped.email.trim().toLowerCase();
    if (mapped.phone        != null) out.phone        = mapped.phone.trim() || null;
    if (mapped.date_of_birth) out.date_of_birth = parseDate(mapped.date_of_birth);
    if (mapped.gender       != null) out.gender        = parseGender(mapped.gender);
    if (mapped.is_active    != null) out.is_active     = parseBoolean(mapped.is_active) ?? true;
    if (mapped.ttr_rating   != null) out.ttr_rating    = parseInteger(mapped.ttr_rating);
    if (mapped.qttr_rating  != null) out.qttr_rating   = parseInteger(mapped.qttr_rating);
    if (mapped.entry_date   != null) out.entry_date    = parseDate(mapped.entry_date);
    if (mapped.exit_date    != null) out.exit_date     = parseDate(mapped.exit_date) ?? null;
    if (mapped.zip_code     != null) out.zip_code      = mapped.zip_code.trim() || null;
    if (mapped.city         != null) out.city          = mapped.city.trim() || null;
    if (mapped.street       != null) out.street        = mapped.street.trim() || null;
    if (mapped.member_number!= null) out.member_number = mapped.member_number.trim() || null;
  }

  if (schema === 'clicktt' || schema === 'schedule_match') {
    if (mapped.match_date   != null) out.match_date    = parseDate(mapped.match_date);
    if (mapped.match_time   != null) out.match_time    = parseTime(mapped.match_time);
    if (mapped.match_day    != null) out.match_day     = parseInteger(mapped.match_day);
    if (mapped.home_team    != null) out.home_team     = mapped.home_team.trim();
    if (mapped.away_team    != null) out.away_team     = mapped.away_team.trim();
    if (mapped.venue        != null) out.venue         = mapped.venue.trim() || null;

    if (mapped.result != null) {
      const result = parseMatchResult(mapped.result);
      out.result         = result;
      out.home_score     = result?.isPostponed || result?.isForfeited ? null : result?.homeScore ?? null;
      out.away_score     = result?.isPostponed || result?.isForfeited ? null : result?.awayScore ?? null;
      out.status         = result?.isPostponed ? 'verschoben'
                         : result == null       ? 'geplant'
                         : 'beendet';
    } else {
      out.status = 'geplant';
    }
  }

  return out;
}

/**
 * Vollständige Normalisierung einer Roh-Zeile.
 * Kombiniert applyColumnMap + normalizeFields.
 */
export function normalizeRow(
  raw: RawRow,
  rowIndex: number,
  columnMap: ColumnMap,
  schema: ImportSchemaType,
): NormalizedRow {
  const mapped = applyColumnMap(raw, columnMap);
  const data   = normalizeFields(mapped, schema);
  return { raw, data, rowIndex };
}

/**
 * Normalisiert alle Zeilen einer Import-Datei.
 * Leere Zeilen (alle Felder leer) werden übersprungen.
 */
export function normalizeRows(
  rows: RawRow[],
  columnMap: ColumnMap,
  schema: ImportSchemaType,
): NormalizedRow[] {
  const result: NormalizedRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // Leere Zeilen überspringen
    if (Object.values(row).every((v) => v.trim() === '')) continue;
    result.push(normalizeRow(row, i, columnMap, schema));
  }
  return result;
}
