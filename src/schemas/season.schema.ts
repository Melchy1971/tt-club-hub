import { z } from 'zod';

// Re-use the canonical ageGroupSchema from team.schema to avoid duplicate exports
import { ageGroupSchema } from './team.schema';
export { ageGroupSchema as seasonAgeGroupSchema };

export const phaseTypeSchema = z.enum(['first_half', 'second_half', 'single_half']);

export const seasonCycleCreateSchema = z
  .object({
    name: z.string().min(1, 'Saisonname ist erforderlich').max(100),
    start_year: z.number().int().min(2000).max(2200),
    end_year: z.number().int().min(2000).max(2201),
    is_active: z.boolean().default(false),
    age_group: ageGroupSchema.default('herren'),
  })
  .refine((data) => data.start_year < data.end_year, {
    message: 'start_year muss kleiner als end_year sein',
    path: ['end_year'],
  });

export const seasonPhaseCreateSchema = z
  .object({
    season_cycle_id: z.string().uuid('Ungültige Saisonzyklus-ID'),
    phase_type: phaseTypeSchema,
    name: z.string().trim().min(1, 'Phasenname ist erforderlich').max(100),
    start_date: z.string().date('Ungültiges Startdatum'),
    end_date: z.string().date('Ungültiges Enddatum'),
    is_active: z.boolean().default(false),
    sort_order: z.number().int().min(1).max(10).default(1),
  })
  .refine((data) => data.start_date < data.end_date, {
    message: 'Startdatum muss vor dem Enddatum liegen',
    path: ['end_date'],
  });

const seasonCycleBaseSchema = z.object({
  name: z.string().min(1, 'Saisonname ist erforderlich').max(100),
  start_year: z.number().int().min(2000).max(2200),
  end_year: z.number().int().min(2000).max(2201),
  is_active: z.boolean().default(false),
  age_group: ageGroupSchema.default('herren'),
});
export const seasonCycleUpdateSchema = seasonCycleBaseSchema.partial();

const seasonPhaseBaseSchema = z.object({
  season_cycle_id: z.string().uuid('Ungültige Saisonzyklus-ID'),
  phase_type: phaseTypeSchema,
  name: z.string().trim().min(1, 'Phasenname ist erforderlich').max(100),
  start_date: z.string().date('Ungültiges Startdatum'),
  end_date: z.string().date('Ungültiges Enddatum'),
  is_active: z.boolean().default(false),
  sort_order: z.number().int().min(1).max(10).default(1),
});
export const seasonPhaseUpdateSchema = seasonPhaseBaseSchema.partial();

export type SeasonCycleCreateInput = z.infer<typeof seasonCycleCreateSchema>;
export type SeasonCycleUpdateInput = z.infer<typeof seasonCycleUpdateSchema>;
export type SeasonPhaseCreateInput = z.infer<typeof seasonPhaseCreateSchema>;
export type SeasonPhaseUpdateInput = z.infer<typeof seasonPhaseUpdateSchema>;

/** @deprecated Backward-Compat Alias */
export const seasonCreateSchema = seasonCycleCreateSchema;
/** @deprecated Backward-Compat Alias */
export const seasonUpdateSchema = seasonCycleUpdateSchema;
/** @deprecated Backward-Compat Alias */
export type SeasonCreateInput = SeasonCycleCreateInput;
/** @deprecated Backward-Compat Alias */
export type SeasonUpdateInput = SeasonCycleUpdateInput;
