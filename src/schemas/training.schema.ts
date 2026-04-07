import { z } from 'zod';

// ─── Shared primitives ────────────────────────────────────────────────────────

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss im Format YYYY-MM-DD sein');
const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Zeit muss im Format HH:MM sein');

const nullableText = (max: number, field: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === undefined || v === null) return null;
      const trimmed = v.trim();
      return trimmed.length ? trimmed : null;
    })
    .refine((v) => v === null || v.length <= max, `${field} max. ${max} Zeichen`);

// ─── Buchungs-Status ──────────────────────────────────────────────────────────

export const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const bookingStatusSchema = z.enum(BOOKING_STATUSES);

/** Terminale Status – kein weiterer Übergang möglich. */
export const TERMINAL_BOOKING_STATUSES = new Set<BookingStatus>(['cancelled']);

/** Erlaubte Status-Übergänge. */
export const VALID_BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['cancelled'],
  cancelled: [],
};

export function isValidBookingTransition(from: BookingStatus, to: BookingStatus): boolean {
  return VALID_BOOKING_TRANSITIONS[from].includes(to);
}

export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return TERMINAL_BOOKING_STATUSES.has(status);
}

// ─── Trainingsbuchung – Erstellen ─────────────────────────────────────────────

export const trainingBookingCreateSchema = z
  .object({
    requester_id: z.string().uuid('Ungültige requester_id'),
    partner_id:   z.string().uuid('Ungültige partner_id'),
    booking_date: isoDateSchema,
    start_time:   hhmmSchema,
    end_time: z
      .union([hhmmSchema, z.null(), z.undefined()])
      .transform((v) => v ?? null),
    location: nullableText(200, 'Ort'),
    note:     nullableText(500, 'Notiz'),
    created_by: z.string().uuid('Ungültige created_by'),
  })
  .superRefine((d, ctx) => {
    if (d.partner_id === d.requester_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'requester_id und partner_id müssen unterschiedlich sein (Selbstbuchung verboten)',
        path: ['partner_id'],
      });
    }
    if (d.end_time && d.end_time <= d.start_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'end_time muss nach start_time liegen',
        path: ['end_time'],
      });
    }
  });

// ─── Trainingsbuchung – Aktualisieren ─────────────────────────────────────────
// booking_date, requester_id und partner_id sind nicht änderbar.

export const trainingBookingUpdateSchema = z
  .object({
    status:     bookingStatusSchema.optional(),
    location:   nullableText(200, 'Ort').optional(),
    note:       nullableText(500, 'Notiz').optional(),
    start_time: hhmmSchema.optional(),
    end_time:   z.union([hhmmSchema, z.null()]).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.start_time && d.end_time && d.end_time <= d.start_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'end_time muss nach start_time liegen',
        path: ['end_time'],
      });
    }
  });

// ─── Trainingsbuchung – Filter ────────────────────────────────────────────────

export const trainingBookingFilterSchema = z.object({
  /** Exaktes Mitglied als Requester. */
  requester_id: z.string().uuid().optional(),
  /** Exaktes Mitglied als Partner. */
  partner_id: z.string().uuid().optional(),
  /** Requester ODER Partner (für "alle Buchungen eines Mitglieds"). */
  member_id: z.string().uuid().optional(),
  status: bookingStatusSchema.optional(),
  /** Exaktes Buchungsdatum. */
  booking_date: isoDateSchema.optional(),
  /** Buchungen ab diesem Datum. */
  from_date: isoDateSchema.optional(),
  /** Buchungen bis zu diesem Datum. */
  to_date: isoDateSchema.optional(),
  /** Nur zukünftige Buchungen (>= heute). */
  upcoming_only: z.boolean().optional(),
  /** Nur vergangene Buchungen (< heute). */
  past_only: z.boolean().optional(),
});

export type TrainingBookingCreateInput = z.infer<typeof trainingBookingCreateSchema>;
export type TrainingBookingUpdateInput = z.infer<typeof trainingBookingUpdateSchema>;
export type TrainingBookingFilterInput = z.infer<typeof trainingBookingFilterSchema>;

// ─── Team-Trainingsslot – Wochentag ──────────────────────────────────────────

/** ISO-Wochentage: 1 = Montag … 7 = Sonntag */
export const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAY_VALUES)[number];

export const weekdaySchema = z
  .number()
  .int()
  .min(1, 'Wochentag muss zwischen 1 (Mo) und 7 (So) liegen')
  .max(7, 'Wochentag muss zwischen 1 (Mo) und 7 (So) liegen')
  .transform((n) => n as Weekday);

// ─── Team-Trainingsslot – Erstellen ──────────────────────────────────────────
// Benötigt DB-Tabelle team_training_slots (Migration erforderlich).

export const teamTrainingSlotCreateSchema = z
  .object({
    team_id:    z.string().uuid('Ungültige team_id'),
    weekday:    weekdaySchema,
    start_time: hhmmSchema,
    end_time:   hhmmSchema,
    location:   nullableText(200, 'Ort'),
    is_active:  z.boolean().default(true),
    valid_from: isoDateSchema.nullable().optional().transform((v) => v ?? null),
    valid_to:   isoDateSchema.nullable().optional().transform((v) => v ?? null),
  })
  .superRefine((d, ctx) => {
    if (d.end_time <= d.start_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'end_time muss nach start_time liegen',
        path: ['end_time'],
      });
    }
    if (d.valid_from && d.valid_to && d.valid_to < d.valid_from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'valid_to muss nach valid_from liegen',
        path: ['valid_to'],
      });
    }
  });

export const teamTrainingSlotUpdateSchema = z
  .object({
    weekday:    weekdaySchema.optional(),
    start_time: hhmmSchema.optional(),
    end_time:   hhmmSchema.optional(),
    location:   nullableText(200, 'Ort').optional(),
    is_active:  z.boolean().optional(),
    valid_from: isoDateSchema.nullable().optional().transform((v) => v ?? null),
    valid_to:   isoDateSchema.nullable().optional().transform((v) => v ?? null),
  })
  .superRefine((d, ctx) => {
    if (d.start_time && d.end_time && d.end_time <= d.start_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'end_time muss nach start_time liegen',
        path: ['end_time'],
      });
    }
    if (d.valid_from && d.valid_to && d.valid_to < d.valid_from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'valid_to muss nach valid_from liegen',
        path: ['valid_to'],
      });
    }
  });

export const teamTrainingSlotFilterSchema = z.object({
  team_id:   z.string().uuid().optional(),
  weekday:   weekdaySchema.optional(),
  is_active: z.boolean().optional(),
  /** Nur Slots die zum gegebenen Datum gültig sind. */
  on_date:   isoDateSchema.optional(),
});

export type TeamTrainingSlotCreateInput = z.infer<typeof teamTrainingSlotCreateSchema>;
export type TeamTrainingSlotUpdateInput = z.infer<typeof teamTrainingSlotUpdateSchema>;
export type TeamTrainingSlotFilterInput = z.infer<typeof teamTrainingSlotFilterSchema>;
