/**
 * Schema-Erkennung + Header-Mapping
 *
 * Nimmt normalisierte Roh-Header und gibt das erkannte ImportSchema zurück.
 * Unterstützte Quellen:
 *   - Mitglieder-CSV/Excel (vereine-software, eigene Listen)
 *   - click-TT-Spielplanexport (deutsches Format)
 *   - Generischer Spielplan-CSV
 */

import type { ImportSchema, ImportSchemaType, ColumnMap, RawRow } from './types';

// ── Umlaut-Normalisierung ─────────────────────────────────────

const UMLAUTS: Record<string, string> = {
  ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss',
  Ä: 'ae', Ö: 'oe', Ü: 'ue',
};

/**
 * Normalisiert einen Header-String für den Vergleich:
 * - Kleinbuchstaben
 * - Umlaute ersetzen
 * - Leerzeichen/Sonderzeichen auf Minimum reduzieren
 */
export function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[äöüÄÖÜß]/g, (c) => UMLAUTS[c] ?? c)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ── Mitglieder-Header-Aliases ─────────────────────────────────
// Norm-Key → DB-Zielfeld

const MEMBER_ALIASES: Record<string, string> = {
  // Pflichtfelder
  vorname:            'first_name',
  'first name':       'first_name',
  firstname:          'first_name',
  vname:              'first_name',

  nachname:           'last_name',
  familienname:       'last_name',
  'last name':        'last_name',
  lastname:           'last_name',
  nname:              'last_name',
  name:               'last_name',           // Fallback wenn nur "Name" vorhanden

  // Kontakt
  email:              'email',
  'e mail':           'email',
  emailadresse:       'email',
  'e-mail-adresse':   'email',

  telefon:            'phone',
  tel:                'phone',
  phone:              'phone',
  'telefonnummer':    'phone',
  handy:              'mobile',
  mobil:              'mobile',
  mobiltelefon:       'mobile',
  mobilnummer:        'mobile',
  mobile:             'mobile',
  cell:               'mobile',

  // Mitgliedschaft
  mitgliedsnummer:    'member_number',
  'mitglieds nr':     'member_number',
  mnr:                'member_number',
  'member number':    'member_number',
  mitgliedsnr:        'member_number',

  eintrittsdatum:     'entry_date',
  'mitglied seit':    'entry_date',
  'member since':     'entry_date',
  membersince:        'entry_date',
  eintritt:           'entry_date',
  beitrittsdatum:     'entry_date',
  'entry date':       'entry_date',

  austrittsdatum:     'exit_date',
  austritt:           'exit_date',
  'exit date':        'exit_date',

  aktiv:              'is_active',
  active:             'is_active',
  mitglied:           'is_active',

  // Stammdaten
  geburtsdatum:       'date_of_birth',
  birthdate:          'date_of_birth',
  geburtstag:         'date_of_birth',
  dob:                'date_of_birth',
  'date of birth':    'date_of_birth',
  gebdat:             'date_of_birth',

  geschlecht:         'gender',
  sex:                'gender',
  gender:             'gender',

  // Adresse
  strasse:            'street',
  'strae':            'street',              // Umlaut-Normalisierung: Straße
  street:             'street',
  adresse:            'street',

  plz:                'zip_code',
  postleitzahl:       'zip_code',
  'zip code':         'zip_code',
  postcode:           'zip_code',

  ort:                'city',
  stadt:              'city',
  city:               'city',
  wohnort:            'city',

  // Spielstärke
  ttr:                'ttr_rating',
  'ttr zahl':         'ttr_rating',
  'ttr-zahl':         'ttr_rating',
  ttrwert:            'ttr_rating',

  qttr:               'qttr_rating',
  'qttr zahl':        'qttr_rating',
  qttrwert:           'qttr_rating',

  // Altersklasse
  altersklasse:       'age_group',
  'age group':        'age_group',
  altersgruppe:       'age_group',
};

// ── click-TT-Header-Aliases ───────────────────────────────────

const CLICKTT_ALIASES: Record<string, string> = {
  'nr':               'match_day',
  'nr.':              'match_day',
  spieltag:           'match_day',
  spielnummer:        'match_day',
  runde:              'match_day',

  datum:              'match_date',
  spieltag2:          'match_date',         // Sicherheitsnetz

  uhrzeit:            'match_time',
  zeit:               'match_time',
  'anwurf':           'match_time',

  heim:               'home_team',
  heimmannschaft:     'home_team',
  heimteam:           'home_team',

  gast:               'away_team',
  gastmannschaft:     'away_team',
  gastteam:           'away_team',
  auswaerts:          'away_team',

  ergebnis:           'result',
  ergebnis2:          'result',
  score:              'result',

  spiellokal:         'venue',
  'spielstaette':     'venue',              // Normalisiert: Spielstätte
  halle:              'venue',
  spielort:           'venue',
  ort:                'venue',
};

// ── Generischer Spielplan-Aliases ─────────────────────────────

const SCHEDULE_ALIASES: Record<string, string> = {
  ...CLICKTT_ALIASES,
  'home team':        'home_team',
  'away team':        'away_team',
  'match day':        'match_day',
  'match date':       'match_date',
  date:               'match_date',
  time:               'match_time',
  venue:              'venue',
  result:             'result',
  score:              'result',
};

// ── Konfidenz-Berechnung ──────────────────────────────────────

/**
 * Punkte für Pflichtfelder (Fehlen = starker Abzug).
 * Punkte für optionale Felder (Bonus).
 */
interface SchemaSignature {
  required: string[];          // normalisierte Ziel-Felder
  bonus: string[];             // optionale Zusatzpunkte
  aliases: Record<string, string>;
}

const SIGNATURES: Record<Exclude<ImportSchemaType, 'unknown'>, SchemaSignature> = {
  member: {
    required: ['first_name', 'last_name'],
    bonus:    ['email', 'member_number', 'date_of_birth', 'gender', 'ttr_rating'],
    aliases:  MEMBER_ALIASES,
  },
  clicktt: {
    required: ['match_date', 'home_team', 'away_team'],
    bonus:    ['match_day', 'match_time', 'result', 'venue'],
    aliases:  CLICKTT_ALIASES,
  },
  schedule_match: {
    required: ['match_date', 'home_team', 'away_team'],
    bonus:    ['match_day', 'match_time', 'result', 'venue'],
    aliases:  SCHEDULE_ALIASES,
  },
};

function scoreHeaders(
  normalizedHeaders: string[],
  sig: SchemaSignature,
): { mappedTargets: Set<string>; score: number } {
  const mappedTargets = new Set<string>();
  for (const h of normalizedHeaders) {
    const target = sig.aliases[h];
    if (target) mappedTargets.add(target);
  }

  const requiredHit = sig.required.filter((f) => mappedTargets.has(f)).length;
  const requiredTotal = sig.required.length;
  const bonusHit = sig.bonus.filter((f) => mappedTargets.has(f)).length;

  // Pflichtfelder zählen 2× mehr als Bonus-Felder
  const score = (requiredHit * 2 + bonusHit) / (requiredTotal * 2 + sig.bonus.length);
  return { mappedTargets, score };
}

// ── Öffentliche API ───────────────────────────────────────────

/**
 * Erkennt das Import-Schema anhand der Datei-Header.
 *
 * @param rawHeaders  Originale Spaltenüberschriften aus der Datei.
 * @param sampleRows  Erste paar Datenzeilen für zusätzliche Hinweise (optional).
 */
export function detectSchema(rawHeaders: string[], sampleRows: RawRow[] = []): ImportSchema {
  const normalized = rawHeaders.map(normalizeHeader);

  // click-TT hat ein klares Fingerprint: "Ergebnis" UND deutsche Teamfelder
  // Wenn "Ergebnis" als "result" gemappt werden kann UND das Datum im DD.MM.YYYY-Format
  // vorliegt → click-TT bevorzugen (gegenüber schedule_match)
  const hasClickTTDate = sampleRows.some((row) => {
    const dateVal = Object.values(row).find((v) => /^\d{2}\.\d{2}\.\d{4}$/.test(v?.trim() ?? ''));
    return !!dateVal;
  });

  const scores: Record<string, { score: number; mappedTargets: Set<string> }> = {};
  for (const type of ['member', 'clicktt', 'schedule_match'] as const) {
    scores[type] = scoreHeaders(normalized, SIGNATURES[type]);
  }

  // click-TT gegenüber schedule_match bevorzugen, wenn deutscher Datumsformat vorliegt
  if (hasClickTTDate && scores.clicktt.score >= 0.4) {
    scores.schedule_match.score *= 0.5;
  }

  let bestType: ImportSchemaType = 'unknown';
  let bestScore = 0.3; // Mindest-Schwellwert für überhaupt eine Erkennung

  for (const [type, { score }] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type as ImportSchemaType;
    }
  }

  if (bestType === 'unknown') {
    return {
      type: 'unknown',
      confidence: 0,
      columnMap: {},
      unmappedHeaders: rawHeaders,
    };
  }

  // ColumnMap aufbauen: rawHeader → targetField
  const sig = SIGNATURES[bestType as Exclude<ImportSchemaType, 'unknown'>];
  const columnMap: ColumnMap = {};
  const mappedRaws = new Set<string>();

  for (const rawHeader of rawHeaders) {
    const norm = normalizeHeader(rawHeader);
    const target = sig.aliases[norm];
    if (target) {
      columnMap[rawHeader] = target;
      mappedRaws.add(rawHeader);
    }
  }

  const unmappedHeaders = rawHeaders.filter((h) => !mappedRaws.has(h));

  return {
    type:             bestType,
    confidence:       bestScore,
    columnMap,
    unmappedHeaders,
  };
}

/**
 * Wendet ein ColumnMap auf eine RawRow an und gibt ein Record<targetField, rawValue> zurück.
 * Felder ohne Mapping werden unter ihrem Originalnamen durchgereicht (für Debug-Zwecke).
 */
export function applyColumnMap(row: RawRow, columnMap: ColumnMap): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [rawKey, rawVal] of Object.entries(row)) {
    const target = columnMap[rawKey];
    if (target) {
      result[target] = rawVal;
    }
    // Unmapped-Felder als Fallback – z. B. für generische Fehlermeldungen
    else {
      result[`_raw_${rawKey}`] = rawVal;
    }
  }
  return result;
}

/**
 * Gibt alle Pflichtfelder eines Schemas zurück, die im ColumnMap fehlen.
 * Nützlich für frühzeitige Fehlermeldungen in der UI.
 */
export function getMissingRequiredFields(
  type: ImportSchemaType,
  columnMap: ColumnMap,
): string[] {
  if (type === 'unknown') return [];
  const sig = SIGNATURES[type as Exclude<ImportSchemaType, 'unknown'>];
  const mappedTargets = new Set(Object.values(columnMap));
  return sig.required.filter((f) => !mappedTargets.has(f));
}
