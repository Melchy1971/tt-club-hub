import { z } from 'zod';

// ─── Status ───────────────────────────────────────────────────────────────────

export const MATCH_STATUS_VALUES = [
  'geplant',
  'laufend',
  'beendet',
  'verschoben',
  'abgesagt',
] as const;

export type MatchStatusValue = (typeof MATCH_STATUS_VALUES)[number];

export const matchStatusSchema = z.enum(MATCH_STATUS_VALUES);

// ─── Shared field schemas ─────────────────────────────────────────────────────

/** ISO-Datum YYYY-MM-DD */
const isoDateSchema = z.string().date('Ungültiges Datum (erwartet: YYYY-MM-DD)');

/** Zeit HH:MM oder HH:MM:SS */
const timeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Zeit im Format HH:MM oder HH:MM:SS angeben')
  .nullable()
  .optional();

/** TT-Score: 0–20 Punkte pro Mannschaftskampf */
const scoreSchema = z.number().int().min(0).max(20);

// ─── Cross-field Validierungen ────────────────────────────────────────────────

/**
 * Validiert, dass Scores konsistent sind:
 *   - Beide null ODER beide gesetzt (kein Halbresultat)
 *   - Bei status='beendet' müssen beide Scores gesetzt sein
 *   - Bei status='abgesagt'/'verschoben' müssen beide null sein
 */
function validateScoreConsistency(
  data: { home_score?: number | null; away_score?: number | null; status?: MatchStatusValue },
  ctx: z.RefinementCtx,
) {
  const { home_score, away_score, status } = data;
  const homeSet = home_score != null;
  const awaySet = away_score != null;

  // Beide müssen entweder gesetzt oder beide null sein
  if (homeSet !== awaySet) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Heim- und Gast-Score müssen beide eingetragen oder beide leer sein',
      path: homeSet ? ['away_score'] : ['home_score'],
    });
    return;
  }

  if (status === 'beendet' && (!homeSet || !awaySet)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Bei Status „Beendet" müssen beide Scores eingetragen sein',
      path: ['home_score'],
    });
  }

  if ((status === 'abgesagt' || status === 'verschoben') && (homeSet || awaySet)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Bei Status „${status === 'abgesagt' ? 'Abgesagt' : 'Verschoben'}" sollten keine Scores eingetragen werden`,
      path: ['home_score'],
    });
  }
}

// ─── CRUD-Schemas ─────────────────────────────────────────────────────────────

export const matchCreateSchema = z
  .object({
    season_id: z.string().uuid('Ungültige Saison-ID'),
    team_id: z.string().uuid('Ungültige Mannschafts-ID'),
    match_day: z.number().int().min(1).max(99, 'Spieltag max. 99').nullable().optional(),
    match_date: isoDateSchema,
    match_time: timeSchema,
    home_team: z.string().trim().min(1, 'Heimmannschaft ist erforderlich').max(100),
    away_team: z.string().trim().min(1, 'Gastmannschaft ist erforderlich').max(100),
    home_score: scoreSchema.nullable().optional(),
    away_score: scoreSchema.nullable().optional(),
    venue_id: z.string().uuid('Ungültige Spielstätten-ID').nullable().optional(),
    is_home: z.boolean().default(true),
    status: matchStatusSchema.default('geplant'),
    pin: z.string().trim().max(50).nullable().optional(),
    code: z.string().trim().max(50).nullable().optional(),
    report_text: z.string().max(2000).nullable().optional(),
  })
  .superRefine(validateScoreConsistency);

/** Update erlaubt alle Felder außer season_id und team_id. */
export const matchUpdateSchema = matchCreateSchema
  .partial()
  .omit({ season_id: true, team_id: true });

/**
 * Ergebnis-Update-Schema.
 * Erzwingt Score-Konsistenz und Status-Logik.
 */
export const matchResultSchema = z
  .object({
    home_score: scoreSchema.nullable(),
    away_score: scoreSchema.nullable(),
    status: matchStatusSchema,
  })
  .superRefine(validateScoreConsistency);

/** Einzelner Eintrag für Bulk-PIN/Code-Bearbeitung. */
export const pinCodeEntrySchema = z.object({
  id: z.string().uuid('Ungültige Match-ID'),
  pin: z.string().trim().max(50).nullable(),
  code: z.string().trim().max(50).nullable(),
});

export const matchFilterSchema = z.object({
  team_id: z.string().uuid().optional(),
  season_id: z.string().uuid().optional(),
  status: matchStatusSchema.optional(),
  /** ISO-Datum YYYY-MM-DD */
  from_date: isoDateSchema.optional(),
  /** ISO-Datum YYYY-MM-DD */
  to_date: isoDateSchema.optional(),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type MatchCreateInput = z.infer<typeof matchCreateSchema>;
export type MatchUpdateInput = z.infer<typeof matchUpdateSchema>;
export type MatchResultInput = z.infer<typeof matchResultSchema>;
export type PinCodeEntry = z.infer<typeof pinCodeEntrySchema>;
export type MatchFilterInput = z.infer<typeof matchFilterSchema>;
