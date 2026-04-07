import { describe, expect, it } from 'vitest';
import {
  detectSchema,
  normalizeRow,
  deduplicateMembers,
  parseCsvText,
  buildImportPreview,
} from '@/lib/import';
import type { ValidatedRow } from '@/lib/import';

describe('member import parser', () => {
  it('maps birthdate/member_since/mobile aliases for member schema', () => {
    const headers = ['First Name', 'Last Name', 'Birthdate', 'Member Since', 'Mobile', 'TTR', 'QTTR'];
    const schema = detectSchema(headers, []);

    expect(schema.type).toBe('member');
    expect(schema.columnMap.Birthdate).toBe('date_of_birth');
    expect(schema.columnMap['Member Since']).toBe('entry_date');
    expect(schema.columnMap.Mobile).toBe('mobile');
    expect(schema.columnMap.TTR).toBe('ttr_rating');
    expect(schema.columnMap.QTTR).toBe('qttr_rating');
  });

  it('normalizes phone and mobile independently', () => {
    const row = normalizeRow(
      {
        first_name: 'Max',
        last_name: 'Mustermann',
        phone: ' 040   12345 ',
        mobile: ' +49  170 1234567 ',
      },
      0,
      { first_name: 'first_name', last_name: 'last_name', phone: 'phone', mobile: 'mobile' },
      'member',
    );

    expect(row.data.phone).toBe('040 12345');
    expect(row.data.mobile).toBe('+49 170 1234567');
  });

  it('supports configurable duplicate rules', () => {
    const validatedRows: ValidatedRow[] = [
      {
        rowIndex: 0,
        raw: {},
        status: 'valid',
        issues: [],
        data: {
          first_name: 'Anna',
          last_name: 'Meyer',
          date_of_birth: '1990-01-01',
          email: null,
          member_number: null,
        },
      },
    ];

    const result = deduplicateMembers(validatedRows, {
      existing: [
        {
          id: 'm-1',
          first_name: 'Anna',
          last_name: 'Meyer',
          date_of_birth: '1990-01-01',
          email: null,
          member_number: null,
        },
      ],
      conflictStrategy: 'update',
      rules: ['name_birthdate'],
    });

    expect(result[0].action).toBe('update');
    expect(result[0].matchedBy).toBe('last_name+date_of_birth');
  });

  it('builds preview rows with valid/warning/error states', () => {
    const preview = buildImportPreview([
      { rowIndex: 0, raw: {}, data: { first_name: 'A' }, status: 'valid', issues: [] },
      {
        rowIndex: 1,
        raw: {},
        data: { first_name: 'B' },
        status: 'warning',
        issues: [{ field: 'email', message: 'Missing', severity: 'warning' }],
      },
      {
        rowIndex: 2,
        raw: {},
        data: { first_name: '' },
        status: 'error',
        issues: [{ field: 'first_name', message: 'Required', severity: 'error' }],
      },
    ]);

    expect(preview.map((r) => r.status)).toEqual(['valid', 'warning', 'error']);
    expect(preview[2].action).toBe('conflict');
  });

  it('parses CSV robustly with BOM headers', () => {
    const csv = '\uFEFFfirst_name,last_name,email\nMax,Mustermann,max@example.org';
    const parsed = parseCsvText(csv);
    expect(parsed.headers).toEqual(['first_name', 'last_name', 'email']);
    expect(parsed.rows[0].email).toBe('max@example.org');
  });
});
