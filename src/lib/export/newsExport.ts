/**
 * News-Export-Builder
 *
 * Erstellt ein ExportDocument aus NewsArticleUI-Daten.
 * Das Dokument kann anschließend von csvAdapter oder einem PDF-Adapter
 * gerendert werden.
 *
 * Anwendungsfälle:
 *   - Redaktionsübersicht aller Artikel (intern)
 *   - Archivexport publizierter Vereinsmitteilungen
 *   - Kategorien- / Taglist-Auswertung
 */

import type { NewsArticleUI } from '@/types/domain/news';
import type { ExportDocument, ExportTableSection } from './types';
import { formatDate } from '@/lib/date';

// ── Optionen ──────────────────────────────────────────────────

export interface NewsExportOptions {
  title?:           string;
  subtitle?:        string;
  clubName?:        string;
  /** true → interne Artikel einschließen (nur für eingeloggte Nutzer aufrufen) */
  includeInternal?: boolean;
  /** Nur Artikel dieser Kategorie exportieren */
  category?:        string;
  /** Nur Artikel mit diesen Tags exportieren */
  tags?:            string[];
}

// ── Builder ───────────────────────────────────────────────────

/**
 * Erstellt eine Übersichtstabelle aller gefilterten News-Artikel.
 * Pins erscheinen oben, dann absteigende Veröffentlichungsreihenfolge.
 */
export function buildNewsExport(
  articles: NewsArticleUI[],
  options: NewsExportOptions = {},
): ExportDocument {
  const {
    title           = 'Vereinsmitteilungen',
    subtitle,
    clubName,
    includeInternal = false,
    category,
    tags,
  } = options;

  let filtered = articles.filter((a) => a.isPublished);
  if (!includeInternal) filtered = filtered.filter((a) => !a.isInternal);
  if (category)         filtered = filtered.filter((a) => a.category === category);
  if (tags?.length)     filtered = filtered.filter((a) => tags.some((t) => a.tags.includes(t)));

  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const dateA = a.publishedAt ?? a.createdAt;
    const dateB = b.publishedAt ?? b.createdAt;
    return dateB.localeCompare(dateA);
  });

  const tableSection: ExportTableSection = {
    type:  'table',
    title: `${sorted.length} Beiträge`,
    columns: [
      { key: 'pin',        label: '★',            align: 'center', width: 0.04 },
      { key: 'date',       label: 'Datum',         align: 'left',   width: 0.11 },
      { key: 'title',      label: 'Titel',         align: 'left',   width: 0.35 },
      { key: 'category',   label: 'Kategorie',     align: 'left',   width: 0.15 },
      { key: 'visibility', label: 'Sichtbarkeit',  align: 'left',   width: 0.12 },
      { key: 'tags',       label: 'Tags',          align: 'left',   width: 0.13 },
      { key: 'excerpt',    label: 'Vorschau',      align: 'left',   width: 0.10 },
    ],
    rows: sorted.map((a) => ({
      pin:        a.pinned ? '★' : '',
      date:       a.publishedAt ? formatDate(a.publishedAt) : '–',
      title:      a.title,
      category:   a.category ?? '–',
      visibility: a.isInternal ? 'intern' : 'öffentlich',
      tags:       a.tags.join(', ') || '–',
      excerpt:    a.excerpt ?? '',
    })),
    totals: {
      pin:      `${sorted.length} gesamt`,
      date:     '',
      title:    '',
      category: '',
      visibility: `${sorted.filter((a) => !a.isInternal).length} öffentlich`,
      tags:     '',
      excerpt:  '',
    },
  };

  return {
    filename:    `vereinsmitteilungen-${formatDate(new Date().toISOString()).replace(/\./g, '-')}`,
    title,
    subtitle:    subtitle ?? (category ? `Kategorie: ${category}` : undefined),
    generatedAt: new Date().toISOString(),
    source:      clubName,
    sections:    [tableSection],
    metadata: {
      total:    String(sorted.length),
      public:   String(sorted.filter((a) => !a.isInternal).length),
      internal: String(sorted.filter((a) => a.isInternal).length),
      pinned:   String(sorted.filter((a) => a.pinned).length),
    },
  };
}

/**
 * Erstellt eine Redaktionsübersicht mit allen Artikeln (inkl. Entwürfe).
 * Nur für Admin/Vorstand gedacht.
 */
export function buildNewsEditorialExport(
  articles: NewsArticleUI[],
  options: Omit<NewsExportOptions, 'includeInternal'> = {},
): ExportDocument {
  const { title = 'Redaktionsübersicht', clubName, subtitle } = options;

  const sorted = [...articles].sort((a, b) => {
    // Veröffentlichte zuerst, dann Entwürfe, dann Archiv
    const statusOrder = { published: 0, draft: 1, archived: 2 } as const;
    const orderA = statusOrder[a.status] ?? 3;
    const orderB = statusOrder[b.status] ?? 3;
    if (orderA !== orderB) return orderA - orderB;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  const tableSection: ExportTableSection = {
    type:  'table',
    title: `${sorted.length} Artikel`,
    columns: [
      { key: 'status',     label: 'Status',        align: 'left',   width: 0.11 },
      { key: 'visibility', label: 'Sichtbarkeit',  align: 'left',   width: 0.11 },
      { key: 'date',       label: 'Geändert',      align: 'left',   width: 0.11 },
      { key: 'title',      label: 'Titel',         align: 'left',   width: 0.35 },
      { key: 'category',   label: 'Kategorie',     align: 'left',   width: 0.14 },
      { key: 'slug',       label: 'Slug',          align: 'left',   width: 0.18 },
    ],
    rows: sorted.map((a) => ({
      status:     a.status === 'draft' ? 'Entwurf'
                : a.status === 'published' ? 'Veröffentlicht'
                : 'Archiviert',
      visibility: a.isInternal ? 'intern' : 'öffentlich',
      date:       formatDate(a.updatedAt),
      title:      a.title,
      category:   a.category ?? '–',
      slug:       a.slug,
    })),
  };

  return {
    filename:    `redaktionsuebersicht-${formatDate(new Date().toISOString()).replace(/\./g, '-')}`,
    title,
    subtitle,
    generatedAt: new Date().toISOString(),
    source:      clubName,
    sections:    [tableSection],
    metadata: {
      total:     String(sorted.length),
      published: String(sorted.filter((a) => a.isPublished).length),
      drafts:    String(sorted.filter((a) => a.isDraft).length),
      archived:  String(sorted.filter((a) => a.isArchived).length),
    },
  };
}
