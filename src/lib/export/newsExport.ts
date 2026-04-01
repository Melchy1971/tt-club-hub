/**
 * News-Export-Builder – passend zur vereinfachten news-Tabelle
 */

import type { NewsRow } from '@/types/domain/news';
import type { ExportDocument, ExportTableSection } from './types';
import { formatDate } from '@/lib/date';

export interface NewsExportOptions {
  title?: string;
  subtitle?: string;
  clubName?: string;
}

export function buildNewsExport(
  articles: NewsRow[],
  options: NewsExportOptions = {},
): ExportDocument {
  const { title = 'Vereinsmitteilungen', subtitle, clubName } = options;

  const published = articles
    .filter((a) => a.is_published)
    .sort((a, b) => (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at));

  const tableSection: ExportTableSection = {
    type: 'table',
    title: `${published.length} Beiträge`,
    columns: [
      { key: 'date', label: 'Datum', align: 'left', width: 0.15 },
      { key: 'title', label: 'Titel', align: 'left', width: 0.45 },
      { key: 'status', label: 'Status', align: 'left', width: 0.15 },
    ],
    rows: published.map((a) => ({
      date: a.published_at ? formatDate(a.published_at) : '–',
      title: a.title,
      status: 'Veröffentlicht',
    })),
  };

  return {
    filename: `vereinsmitteilungen-${formatDate(new Date().toISOString()).replace(/\./g, '-')}`,
    title,
    subtitle,
    generatedAt: new Date().toISOString(),
    source: clubName,
    sections: [tableSection],
    metadata: {
      total: String(published.length),
    },
  };
}
