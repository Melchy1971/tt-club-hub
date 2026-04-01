/**
 * Import-Orchestrator
 *
 * Führt alle Pipeline-Phasen durch und gibt einen ImportReport zurück:
 *
 *   1. Detect   – Schema erkennen (oder erzwingen)
 *   2. Validate – Pflichtfelder und Typen prüfen (ohne DB-Zugriff)
 *   3. Deduplicate – gegen übergebene Snapshots abgleichen
 *   4. Execute  – in DB schreiben (skippt bei dryRun)
 *   5. Report   – Ergebniszusammenfassung
 *
 * Partielle Fehlerbehandlung:
 *   Jede Zeile wird unabhängig behandelt. Schlägt eine Zeile fehl, setzen
 *   wir action='failed' im Report und machen mit der nächsten weiter.
 *   Der Import bricht NICHT ab.
 *
 * DB-Schreibzugriff:
 *   Der Runner kennt keine Services direkt. Stattdessen erhält er
 *   `createFn` und `updateFn` Callbacks – das hält ihn testbar und
 *   entkoppelt ihn von Supabase.
 */

import { z } from 'zod';
import type {
  RawRow,
  ImportOptions,
  ImportReport,
  ImportRowResult,
  ValidatedRow,
  ImportRow,
  RowIssue,
  RowStatus,
  NormalizedRow,
  ImportSchemaType,
} from './types';
import { detectSchema, getMissingRequiredFields } from './detect';
import { normalizeRows } from './normalize';
import {
  deduplicateMembers,
  deduplicateMatches,
  findInternalDuplicates,
  memberDuplicateKey,
  matchDuplicateKey,
  type MemberSnapshot,
  type MatchSnapshot,
} from './deduplicate';

// ── Validierungs-Schemas ──────────────────────────────────────

const memberImportSchema = z.object({
  first_name:    z.string().min(1, 'Vorname fehlt'),
  last_name:     z.string().min(1, 'Nachname fehlt'),
  email:         z.string().email('Ungültige E-Mail-Adresse').optional().nullable(),
  member_number: z.string().optional().nullable(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss ISO-Format haben (YYYY-MM-DD)').optional().nullable(),
  entry_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Eintrittsdatum muss ISO-Format haben').optional().nullable(),
  gender:        z.enum(['maennlich', 'weiblich', 'divers']).optional().nullable(),
  ttr_rating:    z.number().int().min(0).max(3500).optional().nullable(),
  qttr_rating:   z.number().int().min(0).max(3500).optional().nullable(),
  is_active:     z.boolean().optional(),
});

const matchImportSchema = z.object({
  match_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss ISO-Format haben'),
  home_team:  z.string().min(1, 'Heimmannschaft fehlt'),
  away_team:  z.string().min(1, 'Gastmannschaft fehlt'),
  match_day:  z.number().int().min(1).optional().nullable(),
  match_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  home_score: z.number().int().min(0).optional().nullable(),
  away_score: z.number().int().min(0).optional().nullable(),
  venue:      z.string().optional().nullable(),
  status:     z.enum(['geplant', 'beendet', 'verschoben', 'laufend']).optional(),
});

// ── Validierungs-Helfer ───────────────────────────────────────

function validateRow(row: NormalizedRow, schema: ImportSchemaType): ValidatedRow {
  const issues: RowIssue[] = [];

  const zodSchema =
    schema === 'member'
      ? memberImportSchema
      : (schema === 'clicktt' || schema === 'schedule_match')
        ? matchImportSchema
        : null;

  if (zodSchema) {
    const result = zodSchema.safeParse(row.data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path.join('.') || 'unbekannt';
        issues.push({ field, message: issue.message, severity: 'error' });
      }
    }
  }

  // Zusätzliche Warnungen (kein Validierungsfehler, aber Hinweis)
  if (schema === 'member') {
    const d = row.data;
    if (!d.email && !d.member_number) {
      issues.push({
        field: 'email/member_number',
        message: 'Weder E-Mail noch Mitgliedsnummer vorhanden – Duplikaterkennung eingeschränkt',
        severity: 'warning',
      });
    }
    if (d.ttr_rating != null && (d.ttr_rating as number) < 500) {
      issues.push({
        field: 'ttr_rating',
        message: `Ungewöhnlich niedriger TTR-Wert: ${d.ttr_rating}`,
        severity: 'warning',
      });
    }
    if (d.date_of_birth == null && d.gender == null) {
      // kein Pflichtfehler, aber Hinweis
    }
  }

  const hasErrors   = issues.some((i) => i.severity === 'error');
  const hasWarnings = issues.some((i) => i.severity === 'warning');

  const status: RowStatus = hasErrors ? 'error' : hasWarnings ? 'warning' : 'valid';

  return { ...row, status, issues };
}

// ── Runner-Kontext für Member-Import ─────────────────────────

export interface MemberRunnerContext {
  schemaType: 'member';
  existing: MemberSnapshot[];
  createFn: (data: Record<string, unknown>) => Promise<{ id: string }>;
  updateFn: (id: string, data: Record<string, unknown>) => Promise<{ id: string }>;
}

// ── Runner-Kontext für Match-Import ──────────────────────────

export interface MatchRunnerContext {
  schemaType: 'clicktt' | 'schedule_match';
  existing: MatchSnapshot[];
  seasonId: string;
  teamId: string;
  createFn: (data: Record<string, unknown>) => Promise<{ id: string }>;
  updateFn: (id: string, data: Record<string, unknown>) => Promise<{ id: string }>;
}

export type RunnerContext = MemberRunnerContext | MatchRunnerContext;

// ── Haupt-Runner ──────────────────────────────────────────────

/**
 * Führt den vollständigen Import durch.
 *
 * @param rawRows      Bereits geparste Tabellenzeilen (von PapaParse / XLSX).
 * @param rawHeaders   Spaltenüberschriften aus der Datei.
 * @param options      Import-Optionen (conflictStrategy, dryRun, …).
 * @param context      Laufzeit-Kontext mit Snapshots und Create/Update-Callbacks.
 *
 * @returns ImportReport mit Zeilen-Ergebnissen und Statistiken.
 */
export async function runImport(
  rawRows: RawRow[],
  rawHeaders: string[],
  options: ImportOptions,
  context: RunnerContext,
): Promise<ImportReport> {
  const globalWarnings: string[] = [];

  // ── Phase 1: Schema-Erkennung ──────────────────────────────
  const schema = detectSchema(rawHeaders, rawRows.slice(0, 5));
  const effectiveSchema = options.schemaType ?? schema.type;

  if (effectiveSchema === 'unknown') {
    return emptyReport('unknown', options.dryRun ?? false, [
      'Schema konnte nicht erkannt werden. Bitte Spalten manuell zuordnen.',
    ]);
  }

  if (schema.confidence < 0.5 && !options.schemaType) {
    globalWarnings.push(
      `Schema-Erkennung unsicher (Konfidenz ${Math.round(schema.confidence * 100)} %). ` +
      `Erkannt als: ${effectiveSchema}. Bitte Zuordnung prüfen.`,
    );
  }

  const missingRequired = getMissingRequiredFields(effectiveSchema, schema.columnMap);
  if (missingRequired.length > 0) {
    return emptyReport(effectiveSchema, options.dryRun ?? false, [
      `Pflichtfelder fehlen: ${missingRequired.join(', ')}`,
    ]);
  }

  // ── Phase 2: Normalisierung ────────────────────────────────
  const normalizedRows = normalizeRows(rawRows, schema.columnMap, effectiveSchema);

  if (normalizedRows.length === 0) {
    return emptyReport(effectiveSchema, options.dryRun ?? false, ['Keine Datenzeilen gefunden.']);
  }

  // ── Phase 3: Interne Duplikate erkennen ───────────────────
  const keyFn = effectiveSchema === 'member' ? memberDuplicateKey : matchDuplicateKey;
  const internalDupes = findInternalDuplicates(normalizedRows, keyFn);
  if (internalDupes.size > 0) {
    const count = [...internalDupes.values()].reduce((s, v) => s + v.length, 0);
    globalWarnings.push(
      `${count} interne Duplikat(e) in der Datei gefunden. ` +
      `Zeilen: ${[...internalDupes.entries()].map(([f, d]) => `#${f + 1} ↔ ${d.map(i => `#${i + 1}`).join(', ')}`).slice(0, 5).join('; ')}`,
    );
  }

  // ── Phase 4: Validierung ───────────────────────────────────
  const validatedRows: ValidatedRow[] = normalizedRows.map((row) =>
    validateRow(row, effectiveSchema),
  );

  const errorCount = validatedRows.filter((r) => r.status === 'error').length;
  if (errorCount > 0) {
    globalWarnings.push(`${errorCount} Zeile(n) enthalten Fehler und werden nicht importiert.`);
  }

  // ── Phase 5: Deduplication ─────────────────────────────────
  let importRows: ImportRow[];

  if (effectiveSchema === 'member') {
    const ctx = context as MemberRunnerContext;
    importRows = deduplicateMembers(validatedRows, {
      existing:         ctx.existing,
      conflictStrategy: options.conflictStrategy,
    });
  } else {
    const ctx = context as MatchRunnerContext;
    importRows = deduplicateMatches(validatedRows, {
      existing:         ctx.existing,
      conflictStrategy: options.conflictStrategy,
    });
  }

  // ── Phase 6: Dry-Run → Report ohne DB-Zugriff ─────────────
  if (options.dryRun) {
    return buildDryRunReport(importRows, effectiveSchema, globalWarnings);
  }

  // ── Phase 7: Import ausführen ──────────────────────────────
  const results: ImportRowResult[] = [];

  for (const row of importRows) {
    // Fehlerhafte oder zu überspringende Zeilen direkt in den Report
    if (row.action === 'conflict' || row.status === 'error') {
      results.push({
        rowIndex: row.rowIndex,
        action:   'failed',
        issues:   row.issues,
        error:    row.issues.find((i) => i.severity === 'error')?.message ?? 'Konflikt',
      });
      continue;
    }

    if (row.action === 'skip') {
      results.push({ rowIndex: row.rowIndex, action: 'skip', id: row.existingId ?? undefined });
      continue;
    }

    // Payload bereinigen (keine internen _raw_-Felder)
    const payload = cleanPayload(row.data, effectiveSchema, context);

    try {
      if (row.action === 'create') {
        const created = await context.createFn(payload);
        results.push({ rowIndex: row.rowIndex, action: 'create', id: created.id });
      } else if (row.action === 'update' && row.existingId) {
        const updated = await context.updateFn(row.existingId, payload);
        results.push({ rowIndex: row.rowIndex, action: 'update', id: updated.id });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({
        rowIndex: row.rowIndex,
        action:   'failed',
        issues:   row.issues,
        error:    msg,
      });
    }
  }

  return buildReport(importRows, results, effectiveSchema, globalWarnings, false);
}

// ── Hilfsfunktionen ───────────────────────────────────────────

/** Bereinigt den Payload für DB-Writes: entfernt _raw_-Felder und fügt Kontext-IDs hinzu. */
function cleanPayload(
  data: Record<string, unknown>,
  schema: ImportSchemaType,
  context: RunnerContext,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith('_raw_') && !k.startsWith('result')) {
      clean[k] = v;
    }
  }
  // Kontext-IDs einsetzen
  if ((schema === 'clicktt' || schema === 'schedule_match') && 'seasonId' in context) {
    clean.season_id = (context as MatchRunnerContext).seasonId;
    clean.team_id   = (context as MatchRunnerContext).teamId;
  }
  return clean;
}

function emptyReport(
  schemaType: ImportSchemaType,
  dryRun: boolean,
  globalWarnings: string[],
): ImportReport {
  return {
    schemaType,
    totalRows: 0,
    created:   0,
    updated:   0,
    skipped:   0,
    failed:    0,
    rows:      [],
    globalWarnings,
    dryRun,
  };
}

function buildDryRunReport(
  importRows: ImportRow[],
  schemaType: ImportSchemaType,
  globalWarnings: string[],
): ImportReport {
  let created = 0, updated = 0, skipped = 0, failed = 0;
  const rows: ImportRowResult[] = importRows.map((row) => {
    switch (row.action) {
      case 'create':   created++;  break;
      case 'update':   updated++;  break;
      case 'skip':     skipped++;  break;
      case 'conflict': failed++;   break;
    }
    return {
      rowIndex: row.rowIndex,
      action:   row.action === 'conflict' ? 'failed' : row.action,
      id:       row.existingId ?? undefined,
      issues:   row.issues.length ? row.issues : undefined,
    };
  });
  return {
    schemaType, totalRows: importRows.length,
    created, updated, skipped, failed, rows, globalWarnings, dryRun: true,
  };
}

function buildReport(
  importRows: ImportRow[],
  results: ImportRowResult[],
  schemaType: ImportSchemaType,
  globalWarnings: string[],
  dryRun: boolean,
): ImportReport {
  let created = 0, updated = 0, skipped = 0, failed = 0;
  for (const r of results) {
    switch (r.action) {
      case 'create':  created++;  break;
      case 'update':  updated++;  break;
      case 'skip':    skipped++;  break;
      case 'failed':  failed++;   break;
    }
  }
  return {
    schemaType,
    totalRows: importRows.length,
    created, updated, skipped, failed,
    rows: results,
    globalWarnings,
    dryRun,
  };
}
