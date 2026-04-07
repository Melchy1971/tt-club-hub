import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ImportPreviewRow, RawRow, RowStatus, ValidatedRow } from './types';
import type { ImportRow } from './types';

export interface ParsedImportFile {
  headers: string[];
  rows: RawRow[];
}

function sanitizeHeaders(headers: string[]): string[] {
  const used = new Map<string, number>();
  return headers.map((h, idx) => {
    const base = (h ?? '').trim() || `column_${idx + 1}`;
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

function normalizeRawRows(rows: Array<Record<string, unknown>>): RawRow[] {
  return rows.map((row) => {
    const out: RawRow = {};
    for (const [k, v] of Object.entries(row)) {
      const str = v == null ? '' : String(v);
      out[k] = str.replace(/^\uFEFF/, '').trim();
    }
    return out;
  });
}

export function parseCsvText(content: string): ParsedImportFile {
  const parsed = Papa.parse<Record<string, unknown>>(content.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
  });

  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new Error(`CSV-Parsefehler in Zeile ${first.row ?? '?'}: ${first.message}`);
  }

  const headers = sanitizeHeaders(parsed.meta.fields ?? []);
  const raw = normalizeRawRows(parsed.data as Array<Record<string, unknown>>);

  const rows = raw.map((r) => {
    const next: RawRow = {};
    headers.forEach((h) => {
      next[h] = r[h] ?? '';
    });
    return next;
  });

  return { headers, rows };
}

export function parseExcelBuffer(buffer: ArrayBuffer): ParsedImportFile {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { headers: [], rows: [] };

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: '',
    raw: false,
  });

  const headers = sanitizeHeaders(Object.keys(rows[0] ?? {}));
  const normalized = normalizeRawRows(rows);

  return {
    headers,
    rows: normalized.map((row) => {
      const out: RawRow = {};
      headers.forEach((h) => {
        out[h] = row[h] ?? '';
      });
      return out;
    }),
  };
}

export function parseImportBuffer(fileName: string, buffer: ArrayBuffer): ParsedImportFile {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') return parseExcelBuffer(buffer);
  if (ext === 'csv' || ext === 'txt') {
    const content = new TextDecoder('utf-8').decode(buffer);
    return parseCsvText(content);
  }
  throw new Error('Nicht unterstütztes Dateiformat. Erlaubt: .csv, .txt, .xlsx, .xls');
}

export function buildImportPreview(rows: Array<ValidatedRow | ImportRow>): ImportPreviewRow[] {
  return rows.map((row) => {
    const status = row.status as RowStatus;
    const action = 'action' in row ? row.action : status === 'error' ? 'conflict' : 'create';
    return {
      rowIndex: row.rowIndex,
      status,
      issues: row.issues,
      action,
      data: row.data,
    };
  });
}
