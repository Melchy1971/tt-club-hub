import { z } from 'zod';

// === Status ===

export const matchStatusSchema = z.enum([
  'geplant',
  'laufend',
  'beendet',
  'verschoben',
  'abgesagt',
]);

// === Score-Validierung ===
// Tischtennis-Mannschaftskampf: max. 9 Gewinnspiele pro Seite

const scoreField = z.number().int().min(0).max(9).nullable().optional();

/** Prüft, ob eine Score-Kombination spiellogisch gültig ist. */
export const scoreRefinement = (
  data: { home_score?: number | null; away_score?: number | null },
  ctx: z.RefinementCtx,
) => {
  const { home_score, away_score } = data;
  if (home_score == null || away_score == null) return; // noch kein Ergebnis – OK
  const total = home_score + away_score;
  if (total > 18) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['home_score'],
      message: 'Gesamtspiele dürfen 18 nicht überschreiten',
    });
  }
  // Genau einer muss 9 erreicht haben, wenn das Ergebnis vollständig ist
  if (home_score !== 9 && away_score !== 9) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['home_score'],
      message: 'Bei einem beendeten Spiel muss eine Mannschaft 9 Siege haben',
    });
  }
};

// === CRUD-Schemas ===

export const scheduleMatchCreateSchema = z
  .object({
    season_cycle_id: z.string().uuid('Ungültige Saisonzyklus-ID').optional(),
    /** @deprecated Alias auf season_cycle_id */
    season_id: z.string().uuid('Ungültige Saison-ID').optional(),
    season_phase_id: z.string().uuid('Ungültige Saisonphasen-ID'),
    team_id: z.string().uuid('Ungültige Mannschafts-ID'),
    match_date: z.string().date('Datum im Format YYYY-MM-DD angeben'),
    match_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Zeit im Format HH:MM angeben')
      .nullable()
      .optional(),
    match_day: z.number().int().min(1).max(99).nullable().optional(),
    home_team: z.string().min(1, 'Heimmannschaft ist erforderlich').max(150),
    away_team: z.string().min(1, 'Gastmannschaft ist erforderlich').max(150),
    is_home: z.boolean(),
    home_score: scoreField,
    away_score: scoreField,
    venue_id: z.string().uuid('Ungültige Hallen-ID').nullable().optional(),
    status: matchStatusSchema.default('geplant'),
    pin: z.string().max(20).nullable().optional(),
    code: z.string().max(20).nullable().optional(),
    report_text: z.string().max(5000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.season_cycle_id && !data.season_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['season_cycle_id'],
        message: 'season_cycle_id oder season_id ist erforderlich',
      });
    }
    if (data.status === 'beendet') scoreRefinement(data, ctx);
  });

// Extract the inner object schema before superRefine to allow .partial()
const scheduleMatchBaseSchema = z.object({
  season_cycle_id: z.string().uuid('Ungültige Saisonzyklus-ID').optional(),
  /** @deprecated Alias auf season_cycle_id */
  season_id: z.string().uuid('Ungültige Saison-ID').optional(),
  season_phase_id: z.string().uuid('Ungültige Saisonphasen-ID'),
  team_id: z.string().uuid('Ungültige Mannschafts-ID'),
  match_date: z.string().date('Datum im Format YYYY-MM-DD angeben'),
  match_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Zeit im Format HH:MM angeben')
    .nullable()
    .optional(),
  match_day: z.number().int().min(1).max(99).nullable().optional(),
  home_team: z.string().min(1, 'Heimmannschaft ist erforderlich').max(150),
  away_team: z.string().min(1, 'Gastmannschaft ist erforderlich').max(150),
  is_home: z.boolean(),
  home_score: scoreField,
  away_score: scoreField,
  venue_id: z.string().uuid('Ungültige Hallen-ID').nullable().optional(),
  status: matchStatusSchema.default('geplant'),
  pin: z.string().max(20).nullable().optional(),
  code: z.string().max(20).nullable().optional(),
  report_text: z.string().max(5000).nullable().optional(),
});

export const scheduleMatchUpdateSchema = scheduleMatchBaseSchema
  .partial()
  .omit({ season_id: true, team_id: true });

export const scheduleMatchFilterSchema = z.object({
  team_id: z.string().uuid().optional(),
  season_cycle_id: z.string().uuid().optional(),
  /** @deprecated Alias auf season_cycle_id */
  season_id: z.string().uuid().optional(),
  season_phase_id: z.string().uuid().optional(),
  /** Wenn true, wird auf season_phases.is_active=true gefiltert. */
  active_phase: z.boolean().optional(),
  status: matchStatusSchema.optional(),
  is_home: z.boolean().optional(),
  from_date: z.string().date().optional(),
  to_date: z.string().date().optional(),
  match_day: z.number().int().min(1).optional(),
});

// === Bulk pin/code ===

export const pinCodeEntrySchema = z.object({
  id: z.string().uuid('Ungültige Match-ID'),
  pin: z.string().max(20).nullable().optional(),
  code: z.string().max(20).nullable().optional(),
});

export const bulkPinCodeSchema = z
  .array(pinCodeEntrySchema)
  .min(1, 'Mindestens ein Eintrag erforderlich')
  .max(100, 'Maximal 100 Einträge pro Batch');

// === click-TT Import ===
// Spaltennamen nach click-TT CSV-Export (Mannschaftsspielbetrieb)

export const clickTTRowSchema = z.object({
  /** Spieltag-Nummer, z.B. 1–22 */
  match_day: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === 'string' ? parseInt(v, 10) : v))
    .pipe(z.number().int().min(1).max(99)),
  /** Datum im Format "DD.MM.YYYY" oder ISO */
  date: z.string().min(1, 'Datum fehlt'),
  /** Uhrzeit im Format "HH:MM" oder leer */
  time: z.string().optional().default(''),
  home_team: z.string().min(1, 'Heimmannschaft fehlt').max(150),
  away_team: z.string().min(1, 'Gastmannschaft fehlt').max(150),
  /** Ergebnis als "9:5", "9:7" oder leer wenn nicht gespielt */
  result: z.string().optional().default(''),
  venue: z.string().optional().default(''),
});

// === Vereinsspielplan Import ===
// Spalten: Termin;Wochentag;Staffel;Runde;HalleNr;HeimMannschaft;GastMannschaft

export const vereinsspielplanRowSchema = z.object({
  /** Termin im Format "DD.MM.YYYY HH:MM" */
  Termin: z.string().min(1, 'Termin fehlt'),
  /** Wochentag z.B. "Sa.", "So.", "Fr." – informativ */
  Wochentag: z.string().optional().default(''),
  /** Staffel z.B. "Erwachsene Bezirksliga", "Jugend 19 Kreisliga A1 VR" */
  Staffel: z.string().min(1, 'Staffel fehlt'),
  /** Runde z.B. "VR", "RR", "Pokal" */
  Runde: z.string().optional().default(''),
  /** Hallennummer (kann leer sein) */
  HalleNr: z.string().optional().default(''),
  /** Heimmannschaft */
  HeimMannschaft: z.string().min(1, 'Heimmannschaft fehlt').max(200),
  /** Gastmannschaft */
  GastMannschaft: z.string().min(1, 'Gastmannschaft fehlt').max(200),
});

// === Ergebnis-Update ===

export const matchResultUpdateSchema = z
  .object({
    home_score: z.number().int().min(0).max(9),
    away_score: z.number().int().min(0).max(9),
    status: matchStatusSchema.optional(),
    report_text: z.string().max(5000).nullable().optional(),
  })
  .superRefine((data, ctx) => scoreRefinement(data, ctx));

export type MatchStatusValue = z.infer<typeof matchStatusSchema>;
export type ScheduleMatchCreateInput = z.infer<typeof scheduleMatchCreateSchema>;
export type ScheduleMatchUpdateInput = z.infer<typeof scheduleMatchUpdateSchema>;
export type ScheduleMatchFilterInput = z.infer<typeof scheduleMatchFilterSchema>;
export type PinCodeEntry = z.infer<typeof pinCodeEntrySchema>;
export type BulkPinCodeInput = z.infer<typeof bulkPinCodeSchema>;
export type ClickTTRow = z.infer<typeof clickTTRowSchema>;
export type VereinsspielplanRow = z.infer<typeof vereinsspielplanRowSchema>;
export type MatchResultUpdateInput = z.infer<typeof matchResultUpdateSchema>;
