import { z } from 'zod';

export const memberGenderSchema = z.enum(['männlich', 'weiblich', 'divers']);

export const memberCreateSchema = z.object({
  first_name: z.string().min(1, 'Vorname ist erforderlich').max(100),
  last_name: z.string().min(1, 'Nachname ist erforderlich').max(100),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  phone: z.string().max(30).nullable().optional(),
  date_of_birth: z.string().date('Ungültiges Datum').nullable().optional(),
  gender: memberGenderSchema.nullable().optional(),
  street: z.string().max(200).nullable().optional(),
  zip_code: z
    .string()
    .regex(/^\d{5}$/, 'PLZ muss genau 5 Ziffern enthalten')
    .nullable()
    .optional(),
  city: z.string().max(100).nullable().optional(),
  member_number: z.string().max(20).nullable().optional(),
  entry_date: z.string().date('Ungültiges Eintrittsdatum'),
  exit_date: z.string().date('Ungültiges Austrittsdatum').nullable().optional(),
  is_active: z.boolean().default(true),
  ttr_rating: z.number().int().min(0).max(3500).nullable().optional(),
  qttr_rating: z.number().int().min(0).max(3500).nullable().optional(),
  club_id: z.string().uuid('Ungültige Verein-ID').nullable().optional(),
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
