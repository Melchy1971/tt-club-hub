import { z } from 'zod';

export const ageGroupSchema = z.enum(['erwachsene', 'jugend']);

export const seasonCreateSchema = z
  .object({
    name: z.string().min(1, 'Saisonname ist erforderlich').max(100),
    start_date: z.string().date('Ungültiges Startdatum'),
    end_date: z.string().date('Ungültiges Enddatum'),
    is_current: z.boolean().default(false),
    age_group: ageGroupSchema.default('erwachsene'),
  })
  .refine((data) => data.start_date < data.end_date, {
    message: 'Startdatum muss vor dem Enddatum liegen',
    path: ['end_date'],
  });

export const seasonUpdateSchema = seasonCreateSchema.innerType().partial();

export type SeasonCreateInput = z.infer<typeof seasonCreateSchema>;
export type SeasonUpdateInput = z.infer<typeof seasonUpdateSchema>;
