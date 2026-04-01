import { z } from 'zod';
import { isISODateString, normalizeISODateValue } from '@/lib/date';

const nullableString = (max: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    },
    z.string().max(max).nullable().optional(),
  );

const nullableIsoDate = z.preprocess(
  (value) => normalizeISODateValue(value),
  z
    .string()
    .refine((value) => isISODateString(value), 'Ungültiges Datum (erwartet YYYY-MM-DD)')
    .nullable()
    .optional(),
);

const nullableRating = z.preprocess(
  (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') return null;
      return Number(trimmed);
    }
    return value;
  },
  z.number().int().min(0).max(3500).nullable().optional(),
);

export const memberGenderSchema = z.enum(['maennlich', 'weiblich', 'divers']);

export const memberCreateSchema = z.object({
  first_name: z.string().min(1, 'Vorname ist erforderlich').max(100),
  last_name: z.string().min(1, 'Nachname ist erforderlich').max(100),
  email: z.preprocess(
    (value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    },
    z.string().email('Ungültige E-Mail-Adresse').nullable().optional(),
  ),
  phone: nullableString(30),
  mobile: nullableString(30),
  date_of_birth: nullableIsoDate,
  gender: memberGenderSchema.nullable().optional(),
  street: nullableString(200),
  zip_code: z
    .preprocess(
      (value) => {
        if (value === undefined) return undefined;
        if (value === null) return null;
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        return trimmed === '' ? null : trimmed;
      },
      z.string().regex(/^\d{5}$/, 'PLZ muss genau 5 Ziffern enthalten').nullable().optional(),
    )
    .nullable()
    .optional(),
  city: nullableString(100),
  member_number: nullableString(20),
  entry_date: z.preprocess(
    (value) => {
      if (value === undefined) return undefined;
      return normalizeISODateValue(value);
    },
    z
      .string()
      .refine((value) => isISODateString(value), 'Eintrittsdatum muss YYYY-MM-DD sein')
      .optional(),
  ),
  exit_date: nullableIsoDate,
  is_active: z.boolean().default(true),
  ttr_rating: nullableRating,
  qttr_rating: nullableRating,
  age_group: z.string().nullable().optional(),
  user_id: z.string().uuid('Ungültige User-ID').nullable().optional(),
});

export const memberUpdateSchema = memberCreateSchema.partial();

export const memberFilterSchema = z.object({
  is_active: z.boolean().optional(),
  search: z.string().optional(),
  team_id: z.string().uuid().optional(),
});

export type MemberCreateInput = z.infer<typeof memberCreateSchema>;
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;
export type MemberFilterInput = z.infer<typeof memberFilterSchema>;
