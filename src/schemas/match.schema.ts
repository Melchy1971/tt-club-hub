import { z } from 'zod';

export const matchStatusSchema = z.enum(['geplant', 'laufend', 'beendet', 'verschoben']);

export const matchCreateSchema = z.object({
  season_id: z.string().uuid('Ungültige Saison-ID'),
  team_id: z.string().uuid('Ungültige Mannschafts-ID'),
  match_day: z.number().int().min(1).max(34, 'Spieltag max. 34'),
  date: z.string().date('Ungültiges Datum'),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Zeit im Format HH:MM angeben')
    .nullable()
    .optional(),
  home_team: z.string().min(1, 'Heimmannschaft ist erforderlich').max(100),
  away_team: z.string().min(1, 'Gastmannschaft ist erforderlich').max(100),
  home_score: z.number().int().min(0).max(9).nullable().optional(),
  away_score: z.number().int().min(0).max(9).nullable().optional(),
  venue: z.string().max(200).nullable().optional(),
  is_home: z.boolean(),
  status: matchStatusSchema.default('geplant'),
});

export const matchUpdateSchema = matchCreateSchema
  .partial()
  .omit({ season_id: true, team_id: true });

export const matchFilterSchema = z.object({
  team_id: z.string().uuid().optional(),
  season_id: z.string().uuid().optional(),
  status: matchStatusSchema.optional(),
  from_date: z.string().date().optional(),
  to_date: z.string().date().optional(),
});

export type MatchCreateInput = z.infer<typeof matchCreateSchema>;
export type MatchUpdateInput = z.infer<typeof matchUpdateSchema>;
export type MatchFilterInput = z.infer<typeof matchFilterSchema>;
