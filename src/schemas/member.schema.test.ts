import { describe, expect, it } from 'vitest';
import { memberCreateSchema } from '@/schemas/member.schema';

const basePayload = {
  first_name: 'Max',
  last_name: 'Mustermann',
  entry_date: '2026-04-01',
};

describe('memberCreateSchema', () => {
  it('normalisiert leere optionale Felder auf null', () => {
    const result = memberCreateSchema.parse({
      ...basePayload,
      phone: ' ',
      mobile: '',
      date_of_birth: ' ',
      ttr_rating: '',
      qttr_rating: ' ',
    });

    expect(result.phone).toBeNull();
    expect(result.mobile).toBeNull();
    expect(result.date_of_birth).toBeNull();
    expect(result.ttr_rating).toBeNull();
    expect(result.qttr_rating).toBeNull();
  });

  it('akzeptiert Zahlen als String und wandelt sie in Number um', () => {
    const result = memberCreateSchema.parse({
      ...basePayload,
      ttr_rating: '1800',
      qttr_rating: '1705',
    });

    expect(result.ttr_rating).toBe(1800);
    expect(result.qttr_rating).toBe(1705);
  });

  it('lehnt ungültige Zahlen ab', () => {
    const result = memberCreateSchema.safeParse({
      ...basePayload,
      ttr_rating: '18xx',
    });

    expect(result.success).toBe(false);
  });

  it('standardisiert und validiert ISO-Datumsformat', () => {
    const valid = memberCreateSchema.safeParse({
      ...basePayload,
      date_of_birth: new Date('2000-05-20T12:00:00.000Z'),
      exit_date: '2026-04-30',
    });
    const invalid = memberCreateSchema.safeParse({
      ...basePayload,
      date_of_birth: '20.05.2000',
      exit_date: '2026-02-31',
    });

    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.date_of_birth).toBe('2000-05-20');
    }
    expect(invalid.success).toBe(false);
  });
});
