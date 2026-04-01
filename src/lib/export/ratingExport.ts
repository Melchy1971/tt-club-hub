/**
 * QTTR / TTR Rating-Export
 */

import type { MemberUI } from '@/types/member';
import type { ExportDocument, ExportTableSection } from './types';
import { formatDate } from '@/lib/date';

// ── Zeilen-Shape ──────────────────────────────────────────────

export interface RatingRow {
  [key: string]: unknown;
  rank:      string;
  fullName:  string;
  ttr:       string;
  qttr:      string;
  ageGroup:  string;
  team:      string;
}

// ── Build-Optionen ────────────────────────────────────────────

export interface RatingExportOptions {
  title?:    string;
  subtitle?: string;
  clubName?: string;
  ttrOnly?:  boolean;
  qttrOnly?: boolean;
  ageGroup?: string;
}

// ── Builder ───────────────────────────────────────────────────

export function buildRatingExport(
  members: MemberUI[],
  options: RatingExportOptions = {},
): ExportDocument {
  const {
    title    = 'Vereinsrangliste',
    subtitle,
    clubName,
    ttrOnly  = false,
    qttrOnly = false,
    ageGroup,
  } = options;

  let filtered = members.filter((m) => m.isActive);
  if (ttrOnly)  filtered = filtered.filter((m) => m.ttr != null);
  if (qttrOnly) filtered = filtered.filter((m) => m.qttr != null);
  if (ageGroup) filtered = filtered.filter((m) => m.ageGroup === ageGroup);

  filtered.sort((a, b) => {
    const ttrDiff = (b.ttr ?? 0) - (a.ttr ?? 0);
    if (ttrDiff !== 0) return ttrDiff;
    const qttrDiff = (b.qttr ?? 0) - (a.qttr ?? 0);
    if (qttrDiff !== 0) return qttrDiff;
    return a.fullName.localeCompare(b.fullName, 'de');
  });

  const rows: RatingRow[] = filtered.map((m, i) => ({
    rank:     String(i + 1),
    fullName: m.fullName,
    ttr:      m.ttr != null ? String(m.ttr) : '–',
    qttr:     m.qttr != null ? String(m.qttr) : '–',
    ageGroup: m.ageGroup ?? '–',
    team:     '–',
  }));

  const tableSection: ExportTableSection = {
    type:  'table',
    title: `${filtered.length} Mitglieder`,
    columns: [
      { key: 'rank',     label: '#',          align: 'right',  width: 0.06 },
      { key: 'fullName', label: 'Name',        align: 'left',   width: 0.28 },
      { key: 'ttr',      label: 'TTR',         align: 'right',  width: 0.12 },
      { key: 'qttr',     label: 'QTTR',        align: 'right',  width: 0.12 },
      { key: 'ageGroup', label: 'Altersklasse',align: 'left',   width: 0.22 },
      { key: 'team',     label: 'Mannschaft',  align: 'left',   width: 0.20 },
    ],
    rows,
    totals: {
      rank:     `${filtered.length} gesamt`,
      fullName: '',
      ttr:      filtered.some((m) => m.ttr != null)
        ? `Ø ${Math.round(filtered.reduce((s, m) => s + (m.ttr ?? 0), 0) / filtered.filter((m) => m.ttr != null).length)}`
        : '',
    },
  };

  return {
    filename:    `vereinsrangliste-${formatDate(new Date().toISOString()).replace(/\./g, '-')}`,
    title,
    subtitle:    subtitle ?? (ageGroup ? `Altersklasse: ${ageGroup}` : undefined),
    generatedAt: new Date().toISOString(),
    source:      clubName,
    sections:    [tableSection],
    metadata: {
      total:   String(filtered.length),
      hasTtr:  String(filtered.filter((m) => m.ttr != null).length),
      hasQttr: String(filtered.filter((m) => m.qttr != null).length),
    },
  };
}

export function buildQttrExport(
  members: MemberUI[],
  clubName?: string,
): ExportDocument {
  return buildRatingExport(members, {
    title:    'QTTR-Jugendrangliste',
    subtitle: 'Nur Mitglieder mit Jugendwertung',
    clubName,
    qttrOnly: true,
  });
}
