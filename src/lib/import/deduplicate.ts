/**
 * Duplikaterkennung + Match-Strategien
 *
 * Liefert für jede normalisierte Zeile eine ImportRow mit:
 *   action:         create | update | skip | conflict
 *   existingId:     ID des gematchten DB-Eintrags (null = neu)
 *   matchedBy:      Felder/Strategie des Matches
 *   conflictFields: Felder mit abweichenden Werten
 *
 * Strategien:
 *
 *   Mitglieder:
 *     1. EXACT_EMAIL        – E-Mail-Übereinstimmung (stärkster Indikator)
 *     2. EXACT_MEMBER_NR    – Mitgliedsnummer (eindeutig, wenn gepflegt)
 *     3. NAME_DOB           – Nachname + Geburtsdatum (robust)
 *     4. FUZZY_NAME         – Vorname + Nachname (Levenshtein ≤ 1 je Feld)
 *
 *   Sitzungen / Spielplan:
 *     1. MATCHDAY_TEAMS     – Spieltag + Heim + Gast (click-TT)
 *     2. DATE_TEAMS         – Datum + Heim + Gast (generisch)
 */

import { normalizeTeamName } from './normalize';
import type { NormalizedRow, ValidatedRow, ImportRow, ConflictStrategy } from './types';

// ── Levenshtein-Distanz ───────────────────────────────────────

/** Einfache Levenshtein-Implementierung ohne externe Abhängigkeit. */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyNameMatch(a: string, b: string, maxDist = 1): boolean {
  if (!a || !b) return false;
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return true;
  return levenshtein(na, nb) <= maxDist;
}

// ── Snapshot-Typen (DB-Daten, gegen die verglichen wird) ──────

export interface MemberSnapshot {
  id:            string;
  email:         string | null;
  member_number: string | null;
  first_name:    string;
  last_name:     string;
  date_of_birth: string | null;
}

export interface MatchSnapshot {
  id:         string;
  match_day:  number | null;
  match_date: string;
  home_team:  string;
  away_team:  string;
}

// ── Hilfsfunktionen ───────────────────────────────────────────

/** Vergleicht zwei Werte und gibt true zurück, wenn sie sich inhaltlich unterscheiden. */
function valuesDiffer(a: unknown, b: unknown): boolean {
  // Beide null/undefined → kein Konflikt
  if ((a == null || a === '') && (b == null || b === '')) return false;
  return String(a ?? '') !== String(b ?? '');
}

/** Findet alle Felder, bei denen Importzeile und bestehender Datensatz abweichen. */
function findConflicts(incoming: Record<string, unknown>, existing: Record<string, unknown>): string[] {
  return Object.keys(incoming).filter(
    (k) => !k.startsWith('_raw_') && valuesDiffer(incoming[k], existing[k]),
  );
}

// ── Mitglieder-Deduplication ──────────────────────────────────

export interface DeduplicateMembersOptions {
  existing:          MemberSnapshot[];
  conflictStrategy:  ConflictStrategy;
}

/**
 * Vergleicht normalisierte Import-Zeilen gegen bestehende Mitglieder.
 *
 * Strategie-Reihenfolge (absteigend nach Zuverlässigkeit):
 *   1. E-Mail (Exact Match)
 *   2. Mitgliedsnummer (Exact Match)
 *   3. Nachname + Geburtsdatum (beide müssen vorhanden sein)
 *   4. Vorname + Nachname (Fuzzy, max. Levenshtein-Distanz 1 je Feld)
 */
export function deduplicateMembers(
  rows: ValidatedRow[],
  opts: DeduplicateMembersOptions,
): ImportRow[] {
  const { existing, conflictStrategy } = opts;

  // Lookup-Indizes für schnelle O(1)-Suche
  const byEmail = new Map<string, MemberSnapshot>();
  const byMemberNr = new Map<string, MemberSnapshot>();
  for (const m of existing) {
    if (m.email)         byEmail.set(m.email.toLowerCase(), m);
    if (m.member_number) byMemberNr.set(m.member_number.trim(), m);
  }

  return rows.map((row): ImportRow => {
    if (row.status === 'error') {
      // Fehlerhafte Zeilen nicht deduplizieren → direkt als conflict markieren
      return {
        ...row,
        action:        'conflict',
        existingId:    null,
        matchedBy:     null,
        conflictFields: [],
      };
    }

    const d = row.data;
    let matched: MemberSnapshot | null = null;
    let matchedBy: string | null = null;

    // Strategie 1: E-Mail
    const email = typeof d.email === 'string' ? d.email.toLowerCase() : null;
    if (!matched && email) {
      const m = byEmail.get(email);
      if (m) { matched = m; matchedBy = 'email'; }
    }

    // Strategie 2: Mitgliedsnummer
    const memberNr = typeof d.member_number === 'string' ? d.member_number.trim() : null;
    if (!matched && memberNr) {
      const m = byMemberNr.get(memberNr);
      if (m) { matched = m; matchedBy = 'member_number'; }
    }

    // Strategie 3: Nachname + Geburtsdatum (beide Felder müssen vorhanden sein)
    const lastName  = typeof d.last_name === 'string' ? d.last_name.toLowerCase().trim() : null;
    const dob       = typeof d.date_of_birth === 'string' ? d.date_of_birth : null;
    if (!matched && lastName && dob) {
      const m = existing.find(
        (e) => e.last_name.toLowerCase().trim() === lastName && e.date_of_birth === dob,
      );
      if (m) { matched = m; matchedBy = 'last_name+date_of_birth'; }
    }

    // Strategie 4: Fuzzy Name (Vorname + Nachname, Levenshtein ≤ 1)
    const firstName = typeof d.first_name === 'string' ? d.first_name : null;
    if (!matched && firstName && lastName) {
      const m = existing.find(
        (e) =>
          fuzzyNameMatch(e.first_name, firstName) &&
          fuzzyNameMatch(e.last_name, typeof d.last_name === 'string' ? d.last_name : ''),
      );
      if (m) { matched = m; matchedBy = 'fuzzy_name'; }
    }

    if (!matched) {
      return { ...row, action: 'create', existingId: null, matchedBy: null, conflictFields: [] };
    }

    const conflictFields = findConflicts(d, matched as unknown as Record<string, unknown>);

    // Konflikt-Strategie anwenden
    if (conflictStrategy === 'skip') {
      return { ...row, action: 'skip', existingId: matched.id, matchedBy, conflictFields };
    }
    if (conflictStrategy === 'update') {
      return { ...row, action: 'update', existingId: matched.id, matchedBy, conflictFields };
    }
    // 'error': Duplikat → conflict (Nutzer muss manuell entscheiden)
    return { ...row, action: 'conflict', existingId: matched.id, matchedBy, conflictFields };
  });
}

// ── Spielplan-Deduplication ───────────────────────────────────

export interface DeduplicateMatchesOptions {
  existing:         MatchSnapshot[];
  conflictStrategy: ConflictStrategy;
}

/**
 * Strategie-Reihenfolge:
 *   1. Spieltag + Heimteam + Gastteam (click-TT)
 *   2. Datum + Heimteam + Gastteam    (generisch)
 *
 * Mannschaftsnamen werden normalisiert (normalizeTeamName) vor dem Vergleich.
 */
export function deduplicateMatches(
  rows: ValidatedRow[],
  opts: DeduplicateMatchesOptions,
): ImportRow[] {
  const { existing, conflictStrategy } = opts;

  // Lookup-Indizes
  const byDayTeams = new Map<string, MatchSnapshot>();
  const byDateTeams = new Map<string, MatchSnapshot>();

  for (const m of existing) {
    const homeN = normalizeTeamName(m.home_team);
    const awayN = normalizeTeamName(m.away_team);

    if (m.match_day != null) {
      byDayTeams.set(`${m.match_day}|${homeN}|${awayN}`, m);
    }
    byDateTeams.set(`${m.match_date}|${homeN}|${awayN}`, m);
  }

  return rows.map((row): ImportRow => {
    if (row.status === 'error') {
      return { ...row, action: 'conflict', existingId: null, matchedBy: null, conflictFields: [] };
    }

    const d = row.data;
    const homeN = typeof d.home_team === 'string' ? normalizeTeamName(d.home_team) : '';
    const awayN = typeof d.away_team === 'string' ? normalizeTeamName(d.away_team) : '';

    let matched: MatchSnapshot | null = null;
    let matchedBy: string | null = null;

    // Strategie 1: Spieltag + Teams
    const matchDay = typeof d.match_day === 'number' ? d.match_day : null;
    if (matchDay != null) {
      const m = byDayTeams.get(`${matchDay}|${homeN}|${awayN}`);
      if (m) { matched = m; matchedBy = 'match_day+teams'; }
    }

    // Strategie 2: Datum + Teams
    const matchDate = typeof d.match_date === 'string' ? d.match_date : null;
    if (!matched && matchDate) {
      const m = byDateTeams.get(`${matchDate}|${homeN}|${awayN}`);
      if (m) { matched = m; matchedBy = 'match_date+teams'; }
    }

    if (!matched) {
      return { ...row, action: 'create', existingId: null, matchedBy: null, conflictFields: [] };
    }

    const conflictFields = findConflicts(
      d,
      matched as unknown as Record<string, unknown>,
    );

    if (conflictStrategy === 'skip') {
      return { ...row, action: 'skip', existingId: matched.id, matchedBy, conflictFields };
    }
    if (conflictStrategy === 'update') {
      return { ...row, action: 'update', existingId: matched.id, matchedBy, conflictFields };
    }
    return { ...row, action: 'conflict', existingId: matched.id, matchedBy, conflictFields };
  });
}

// ── Interne Duplikat-Erkennung (innerhalb der Import-Datei) ───

/**
 * Erkennt Duplikate INNERHALB der Importdatei (nicht gegen DB).
 * Gibt für jede Zeile die Indizes zurück, mit denen sie kollidiert.
 *
 * Nützlich, um dem Nutzer zu zeigen: "Zeile 3 und Zeile 7 sind identisch."
 */
export function findInternalDuplicates(
  rows: NormalizedRow[],
  keyFn: (data: Record<string, unknown>) => string | null,
): Map<number, number[]> {
  const seen = new Map<string, number>(); // key → first rowIndex
  const duplicates = new Map<number, number[]>(); // rowIndex → [conflicting rowIndices]

  for (const row of rows) {
    const key = keyFn(row.data);
    if (!key) continue;

    if (seen.has(key)) {
      const firstIdx = seen.get(key)!;
      if (!duplicates.has(firstIdx)) duplicates.set(firstIdx, []);
      duplicates.get(firstIdx)!.push(row.rowIndex);
    } else {
      seen.set(key, row.rowIndex);
    }
  }

  return duplicates;
}

/** Key-Funktion für Mitglieder-interne Duplikate (E-Mail oder Mitgliedsnummer). */
export function memberDuplicateKey(data: Record<string, unknown>): string | null {
  const email = typeof data.email === 'string' ? data.email.toLowerCase() : null;
  const mnr   = typeof data.member_number === 'string' ? data.member_number.trim() : null;
  return email ?? mnr;
}

/** Key-Funktion für Spielplan-interne Duplikate (Spieltag + Teams oder Datum + Teams). */
export function matchDuplicateKey(data: Record<string, unknown>): string | null {
  const home = typeof data.home_team === 'string' ? normalizeTeamName(data.home_team) : null;
  const away = typeof data.away_team === 'string' ? normalizeTeamName(data.away_team) : null;
  const day  = typeof data.match_day === 'number' ? String(data.match_day) : null;
  const date = typeof data.match_date === 'string' ? data.match_date : null;

  if (!home || !away) return null;
  return `${day ?? date ?? '?'}|${home}|${away}`;
}
