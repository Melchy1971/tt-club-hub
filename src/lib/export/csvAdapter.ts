/**
 * CSV-Adapter
 *
 * Implementiert ExportAdapter für das CSV-Format.
 * Datenfluss:
 *   ExportDocument → csvAdapter.render() → Blob (text/csv;charset=utf-8)
 *
 * Besonderheiten:
 *   - BOM (EF BB BF) für korrekte Excel-Darstellung unter Windows
 *   - RFC 4180-konformes Escaping (Anführungszeichen, Kommas, Zeilenumbrüche)
 *   - Heading / Text / Separator werden als Kommentarzeilen eingefügt (#)
 */

import type { ExportAdapter, ExportDocument, ExportTableSection } from './types';

function csvEscape(value: string): string {
  // Felder mit Komma, Anführungszeichen oder Zeilenumbruch müssen in Quotes
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export const csvAdapter: ExportAdapter = {
  format: 'csv',

  async render(doc: ExportDocument): Promise<Blob> {
    const lines: string[] = [];

    // Dokumentkopf als Kommentar
    lines.push(`# ${doc.title}`);
    if (doc.subtitle)    lines.push(`# ${doc.subtitle}`);
    if (doc.source)      lines.push(`# Quelle: ${doc.source}`);
    lines.push(`# Erstellt: ${new Date(doc.generatedAt).toLocaleString('de-DE')}`);
    lines.push('');

    for (const section of doc.sections) {
      switch (section.type) {
        case 'heading':
          lines.push(`# ${'#'.repeat(section.level - 1)} ${section.content}`.trim());
          break;

        case 'text':
          // Mehrzeiligen Text zeilenweise als Kommentar ausgeben
          for (const line of section.content.split('\n')) {
            lines.push(`# ${line}`);
          }
          break;

        case 'separator':
          lines.push('');
          break;

        case 'table': {
          const table = section as ExportTableSection;
          if (table.title) lines.push(`# ${table.title}`);

          // Kopfzeile
          lines.push(table.columns.map((c) => csvEscape(c.label)).join(','));

          // Datenzeilen
          for (const row of table.rows) {
            const values = table.columns.map((col) => {
              const raw = row[col.key];
              const value = col.format
                ? col.format(raw, row)
                : raw != null ? String(raw) : '';
              return csvEscape(value);
            });
            lines.push(values.join(','));
          }

          // Summenzeile
          if (table.totals) {
            const totalValues = table.columns.map((col) =>
              csvEscape(table.totals![col.key] ?? ''),
            );
            lines.push(totalValues.join(','));
          }

          lines.push('');
          break;
        }
      }
    }

    // BOM + Inhalt: korrekte Excel-Darstellung mit deutschen Umlauten
    const BOM = '\uFEFF';
    return new Blob([BOM + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  },
};
