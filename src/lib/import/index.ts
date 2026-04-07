/**
 * Import-Bibliothek – Öffentliche API
 *
 * Verwendung (Kurzbeispiel):
 *
 * ```ts
 * import { runImport, detectSchema } from '@/lib/import';
 *
 * // Datei mit PapaParse oder XLSX parsen (außerhalb dieser Lib)
 * const { data: rawRows, meta } = Papa.parse<Record<string, string>>(csvString, { header: true });
 *
 * // Schema erkennen (optional, für UI-Vorschau)
 * const schema = detectSchema(meta.fields ?? []);
 *
 * // Import ausführen
 * const report = await runImport(rawRows, meta.fields ?? [], {
 *   conflictStrategy: 'update',
 *   dryRun: false,
 * }, {
 *   schemaType: 'member',
 *   existing: existingMembersSnapshots,
 *   createFn: async (data) => memberService.create(data as MemberCreateDTO),
 *   updateFn: async (id, data) => memberService.update(id, data as MemberUpdateDTO),
 * });
 *
 * console.log(`Erstellt: ${report.created}, Aktualisiert: ${report.updated}, Fehler: ${report.failed}`);
 * ```
 */

// ── Typen ─────────────────────────────────────────────────────
export type {
  RawRow,
  ImportSchemaType,
  ColumnMap,
  ImportSchema,
  NormalizedRow,
  RowIssue,
  IssueSeverity,
  RowStatus,
  ValidatedRow,
  ImportAction,
  ConflictStrategy,
  ImportRow,
  ImportRowResult,
  ImportReport,
  ImportPreviewRow,
  ImportOptions,
  ParsedResult,
} from './types';

// ── Schema-Erkennung ──────────────────────────────────────────
export {
  detectSchema,
  normalizeHeader,
  applyColumnMap,
  getMissingRequiredFields,
} from './detect';

// ── Normalisierung ────────────────────────────────────────────
export {
  parseDate,
  parseTime,
  parseGender,
  parseBoolean,
  parseInteger,
  normalizePhone,
  parseMatchResult,
  normalizeTeamName,
  normalizeRow,
  normalizeRows,
  normalizeFields,
} from './normalize';

// ── Deduplication ─────────────────────────────────────────────
export {
  deduplicateMembers,
  deduplicateMatches,
  findInternalDuplicates,
  memberDuplicateKey,
  matchDuplicateKey,
} from './deduplicate';

export type {
  MemberSnapshot,
  MatchSnapshot,
  DeduplicateMembersOptions,
  DeduplicateMatchesOptions,
  MemberDuplicateRule,
} from './deduplicate';

// ── Datei-Parser + Preview ───────────────────────────────────
export {
  parseCsvText,
  parseExcelBuffer,
  parseImportBuffer,
  buildImportPreview,
} from './parser';

export type {
  ParsedImportFile,
} from './parser';

// ── Orchestrator ──────────────────────────────────────────────
export {
  runImport,
} from './runner';

export type {
  MemberRunnerContext,
  MatchRunnerContext,
  RunnerContext,
} from './runner';
