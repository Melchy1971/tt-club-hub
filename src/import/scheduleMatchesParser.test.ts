import { describe, expect, it } from 'vitest';
import { parseScheduleMatches } from '@/import/scheduleMatchesParser';

describe('parseScheduleMatches', () => {
  it('normalisiert click-TT-ähnliche Felder inkl. phase mapping', () => {
    const report = parseScheduleMatches([
      {
        Datum: '12.09.2026',
        Uhrzeit: '19:30',
        HeimMannschaft: 'TT Club Hub I',
        GastMannschaft: 'SV Gegner I',
        Staffel: 'Erwachsene Bezirksliga Vorrunde',
        HalleNr: 'Halle Ost',
        PIN: 'ABC',
        Code: 'X1',
      },
      {
        Datum: '03.11.2026',
        HeimMannschaft: 'TSV Jugend',
        GastMannschaft: 'TT Club Hub U19',
        Staffel: 'Jugend 19 Kreisliga',
      },
    ], { clubName: 'TT Club Hub' });

    expect(report.rows).toHaveLength(2);
    expect(report.rows[0].status).toBe('partial');
    expect(report.rows[0].draft?.date).toBe('2026-09-12');
    expect(report.rows[0].draft?.isHome).toBe(true);
    expect(report.rows[0].draft?.opponent).toBe('SV Gegner I');
    expect(report.rows[0].draft?.seasonPhase).toBe('first_half');
    expect(report.rows[1].draft?.seasonPhase).toBe('single_half');
    expect(report.rows[1].draft?.isHome).toBe(false);
  });

  it('markiert mehrdeutige/unvollständige Datensätze statt sie zu verwerfen', () => {
    const report = parseScheduleMatches([
      {
        date: '01/02/26',
        home_team: 'Team A',
        away_team: 'Team B',
      },
    ]);

    expect(report.rows[0].status).toBe('failed');
    expect(report.rows[0].issues.some((i) => i.code === 'AMBIGUOUS_DATE')).toBe(true);
    expect(report.rows[0].issues.some((i) => i.code === 'LOW_CONFIDENCE_MATCH')).toBe(true);
  });

  it('erkennt Duplikate', () => {
    const report = parseScheduleMatches([
      { date: '2026-10-10', home_team: 'A', away_team: 'B' },
      { date: '2026-10-10', home_team: 'A', away_team: 'B' },
    ]);

    expect(report.duplicates).toEqual([{ rowIndex: 1, duplicateOfRowIndex: 0 }]);
    expect(report.rows[1].issues.some((i) => i.code === 'DUPLICATE_RECORD')).toBe(true);
  });
});
