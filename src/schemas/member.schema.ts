import { z } from 'zod';

const dateString = z
  .string()
  .trim()
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Ungültiges Datum');

export const memberGenderSchema = z.enum(['maennlich', 'weiblich', 'divers']);

export const memberCreateSchema = z.object({
  first_name: z.string().min(1, 'Vorname ist erforderlich').max(100),
  last_name: z.string().min(1, 'Nachname ist erforderlich').max(100),
  email: z.string().email('Ungültige E-Mail-Adresse').nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  date_of_birth: dateString.nullable().optional(),
  gender: memberGenderSchema.nullable().optional(),
  street: z.string().max(200).nullable().optional(),
  zip_code: z
    .string()
    .regex(/^\d{5}$/, 'PLZ muss genau 5 Ziffern enthalten')
    .nullable()
    .optional(),
  city: z.string().max(100).nullable().optional(),
  member_number: z.string().max(20).nullable().optional(),
  entry_date: dateString.optional(),
  exit_date: dateString.nullable().optional(),
  is_active: z.boolean().default(true),
  ttr_rating: z.number().int().min(0).max(3500).nullable().optional(),
  qttr_rating: z.number().int().min(0).max(3500).nullable().optional(),
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
