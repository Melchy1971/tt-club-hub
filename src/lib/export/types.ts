/**
 * Export-Architektur – Kern-Typen
 *
 * Framework-agnostisch: Diese Typen beschreiben ein logisches Dokument,
 * das von einem Adapter (jspdf, pdfmake, react-pdf, xlsx …) gerendert wird.
 *
 * Datenfluss:
 *   Service-Daten (NewsArticleUI / MemberUI)
 *     → Builder-Funktion (z.B. buildRatingExport)
 *       → ExportDocument
 *         → Adapter (pdfAdapter / csvAdapter)
 *           → Blob / Download
 */

// ── Formate ───────────────────────────────────────────────────

export type ExportFormat = 'pdf' | 'csv' | 'xlsx';

// ── Dokument-Bausteine ────────────────────────────────────────

export interface ExportDocument {
  /** Dateiname ohne Erweiterung */
  filename: string;
  title: string;
  subtitle?: string;
  /** ISO-Datumstring für die Kopfzeile */
  generatedAt: string;
  /** Erzeuger-Information (z.B. Vereinsname) */
  source?: string;
  sections: ExportSection[];
  metadata?: Record<string, string>;
}

export type ExportSection =
  | ExportTableSection
  | ExportTextSection
  | ExportHeadingSection
  | ExportSeparatorSection;

export interface ExportTableSection<T extends Record<string, unknown> = Record<string, unknown>> {
  type: 'table';
  title?: string;
  columns: ExportColumn[];
  rows: T[];
  /** Gesamtzeile am Ende (z.B. Anzahl) */
  totals?: Record<string, string>;
}

export interface ExportColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  width?: number;
  format?: (value: unknown, row: Record<string, unknown>) => string;
}

export interface ExportTextSection {
  type: 'text';
  content: string;
}

export interface ExportHeadingSection {
  type: 'heading';
  level: 1 | 2 | 3;
  content: string;
}

export interface ExportSeparatorSection {
  type: 'separator';
}

// ── Adapter-Interface ─────────────────────────────────────────

/**
 * Jeder Adapter implementiert dieses Interface.
 * Gibt einen Blob zurück, der dem Nutzer zum Download angeboten werden kann.
 */
export interface ExportAdapter {
  format: ExportFormat;
  render(doc: ExportDocument): Promise<Blob>;
}

// ── Download-Helfer ───────────────────────────────────────────

const MIME: Record<ExportFormat, string> = {
  pdf:  'application/pdf',
  csv:  'text/csv;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const EXT: Record<ExportFormat, string> = {
  pdf:  'pdf',
  csv:  'csv',
  xlsx: 'xlsx',
};

/**
 * Löst einen Blob als Datei-Download im Browser aus.
 * Kann von jedem Adapter nach dem Rendern aufgerufen werden.
 */
export function triggerDownload(blob: Blob, filename: string, format: ExportFormat): void {
  const url = URL.createObjectURL(new Blob([blob], { type: MIME[format] }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.${EXT[format]}`;
  a.click();
  URL.revokeObjectURL(url);
}
