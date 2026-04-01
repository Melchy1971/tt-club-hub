/**
 * Import-Pipeline – Core-Typen
 *
 * Phasen-Übersicht:
 *   1. Parse        File → RawRow[]              (PapaParse / XLSX, außerhalb dieser Lib)
 *   2. Detect       RawRow[] → ImportSchema       (detect.ts)
 *   3. Normalize    RawRow[] → NormalizedRow[]    (normalize.ts)
 *   4. Validate     NormalizedRow[] → ValidRow[]  (Zod, innerhalb runner.ts)
 *   5. Deduplicate  ValidRow[] → ImportRow[]      (deduplicate.ts)
 *   6. Execute      ImportRow[] → ImportReport    (runner.ts)
 */

// ── 1. Rohdaten ───────────────────────────────────────────────

/** Eine Tabellenzeile als ungetypte Zeichenketten-Map (Header → Wert). */
export type RawRow = Record<string, string>;

// ── 2. Schema-Erkennung ───────────────────────────────────────

/** Unterstützte Import-Schemata */
export type ImportSchemaType =
  | 'member'          // Mitglieder-CSV/Excel
  | 'schedule_match'  // Spielplan (generisches CSV)
  | 'clicktt'         // click-TT-Export (spezifisches Format)
  | 'unknown';

/**
 * Mapping: Roh-Spaltenname (normalisiert) → Ziel-Feldname im DB-Modell.
 * Nicht gemappte Spalten landen in `unmappedHeaders`.
 */
export type ColumnMap = Record<string, string>;

export interface ImportSchema {
  type: ImportSchemaType;
  /** Erkennungs-Konfidenz 0–1. < 0.5 = unsicherer Treffer. */
  confidence: number;
  /** Mapping der Roh-Header auf Ziel-Felder. */
  columnMap: ColumnMap;
  /** Header, für die kein Mapping gefunden wurde. */
  unmappedHeaders: string[];
}

// ── 3. Normalisierung ─────────────────────────────────────────

export interface NormalizedRow {
  /** Originaldaten (unverändert, für Fehlerberichte). */
  raw: RawRow;
  /** Normalisierte, typisierte Werte (Datum als ISO, Gender als Enum-Wert, …). */
  data: Record<string, unknown>;
  /** 0-basierter Zeilenindex in der ursprünglichen Datei. */
  rowIndex: number;
}

// ── 4. Validierung ────────────────────────────────────────────

export type IssueSeverity = 'error' | 'warning';

export interface RowIssue {
  field: string;
  message: string;
  severity: IssueSeverity;
}

export type RowStatus = 'valid' | 'warning' | 'error';

export interface ValidatedRow extends NormalizedRow {
  status: RowStatus;
  issues: RowIssue[];
}

// ── 5. Duplikaterkennung ──────────────────────────────────────

/**
 * Welche Aktion für diese Zeile beim Import ausgeführt wird.
 *   create   → neue DB-Zeile
 *   update   → bestehenden Datensatz überschreiben
 *   skip     → Duplikat wird ignoriert (conflict-Strategie = 'skip')
 *   conflict → Zeile hat Konflikte, die nicht automatisch gelöst wurden
 */
export type ImportAction = 'create' | 'update' | 'skip' | 'conflict';

/** Strategie bei Duplikatkonflikt. */
export type ConflictStrategy = 'skip' | 'update' | 'error';

export interface ImportRow extends ValidatedRow {
  action: ImportAction;
  /** ID des gematchten existierenden Datensatzes (null = neuer Eintrag). */
  existingId: string | null;
  /** Strategie/Feld, das den Match ausgelöst hat (z. B. "email", "match_day+teams"). */
  matchedBy: string | null;
  /** Felder, die sich vom bestehenden Datensatz unterscheiden. */
  conflictFields: string[];
}

// ── 6. Import-Report ──────────────────────────────────────────

export interface ImportRowResult {
  rowIndex: number;
  action: ImportAction | 'failed';
  /** Datenbank-ID des erstellten/aktualisierten Datensatzes. */
  id?: string;
  issues?: RowIssue[];
  error?: string;
}

export interface ImportReport {
  schemaType: ImportSchemaType;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  rows: ImportRowResult[];
  /** Zeilenübergreifende Warnungen (z. B. niedrige Schema-Konfidenz). */
  globalWarnings: string[];
  dryRun: boolean;
}

// ── Import-Optionen ───────────────────────────────────────────

export interface ImportOptions {
  /**
   * Schema erzwingen. Wenn nicht gesetzt, wird automatisch erkannt.
   * Nützlich, wenn die automatische Erkennung fehlschlägt (< 0.5 Konfidenz).
   */
  schemaType?: ImportSchemaType;
  conflictStrategy: ConflictStrategy;
  /**
   * Probelauf: Validierung + Deduplication ohne DB-Schreibzugriff.
   * Das zurückgegebene ImportReport enthält dryRun=true.
   */
  dryRun?: boolean;
  /** Kontext-IDs für match/schedule-Importe. */
  seasonId?: string;
  teamId?: string;
}

// ── Hilfsfunktionen (Typen) ───────────────────────────────────

/** click-TT Ergebnis nach der Normalisierung. */
export interface ParsedResult {
  homeScore: number;
  awayScore: number;
  /** Original-String (z. B. "9:3", "9:3 n.V.", "Wertung"). */
  raw: string;
  /** Sonderfall: Wertung/Aufgabe/abgesagt. */
  isForfeited: boolean;
  isPostponed: boolean;
}
