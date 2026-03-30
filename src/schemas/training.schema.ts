import { z } from 'zod';

// ─── Booking-Status ───────────────────────────────────────────────────────────

export const BOOKING_STATUSES = ['pending', 'confirmed', 'waitlisted', 'cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const bookingStatusSchema = z.enum(BOOKING_STATUSES);

/** Terminale Status – kein weiterer Übergang möglich. */
export const TERMINAL_BOOKING_STATUSES = new Set<BookingStatus>(['cancelled']);

/** Erlaubte Status-Übergänge (service-seitig gespiegelt aus DB-Logik). */
export const VALID_BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending:    ['confirmed', 'waitlisted', 'cancelled'],
  confirmed:  ['cancelled'],
  waitlisted: ['confirmed', 'cancelled'],
  cancelled:  [],
};

export function isValidBookingTransition(from: BookingStatus, to: BookingStatus): boolean {
  return VALID_BOOKING_TRANSITIONS[from].includes(to);
}

// ─── Training-Session ─────────────────────────────────────────────────────────

export const trainingSessionCreateSchema = z
  .object({
    team_id:         z.string().uuid('Ungültige Mannschafts-ID').nullable().optional(),
    venue_id:        z.string().uuid('Ungültige Hallen-ID').nullable().optional(),
    title:           z.string().max(200).nullable().optional(),
    description:     z.string().max(1000).nullable().optional(),
    start_ts:        z.string().datetime({ message: 'start_ts muss ein gültiger ISO-Datetime sein' }),
    end_ts:          z.string().datetime({ message: 'end_ts muss ein gültiger ISO-Datetime sein' }),
    max_participants: z
      .number()
      .int()
      .min(1, 'Mindestens 1 Teilnehmer')
      .max(100, 'Maximal 100 Teilnehmer')
      .nullable()
      .optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .refine((d) => new Date(d.end_ts) > new Date(d.start_ts), {
    message: 'Endzeit muss nach der Startzeit liegen',
    path: ['end_ts'],
  })
  .refine((d) => new Date(d.start_ts) > new Date(), {
    message: 'Trainingseinheiten können nicht in der Vergangenheit erstellt werden',
    path: ['start_ts'],
  });

export const trainingSessionUpdateSchema = trainingSessionCreateSchema
  .partial()
  .omit({})
  .superRefine((d, ctx) => {
    if (d.start_ts && d.end_ts && new Date(d.end_ts) <= new Date(d.start_ts)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end_ts'],
        message: 'Endzeit muss nach der Startzeit liegen',
      });
    }
  });

export const trainingSessionFilterSchema = z.object({
  team_id:     z.string().uuid().optional(),
  venue_id:    z.string().uuid().optional(),
  from_ts:     z.string().datetime().optional(),
  to_ts:       z.string().datetime().optional(),
  is_cancelled: z.boolean().optional(),
  upcoming_only: z.boolean().optional(),
});

// ─── Training-Booking ─────────────────────────────────────────────────────────

export const trainingBookingCreateSchema = z
  .object({
    session_id:   z.string().uuid('Ungültige Session-ID'),
    requester_id: z.string().uuid('Ungültige Mitglieds-ID'),
    partner_id:   z.string().uuid('Ungültige Partner-ID').nullable().optional(),
    note:         z.string().max(500, 'Notiz max. 500 Zeichen').nullable().optional(),
  })
  .refine(
    (d) => !d.partner_id || d.partner_id !== d.requester_id,
    {
      message: 'Requester und Partner müssen unterschiedliche Personen sein',
      path: ['partner_id'],
    },
  );

/** Nur Status + cancel_reason änderbar nach Create. */
export const trainingBookingUpdateSchema = z.object({
  status:        bookingStatusSchema,
  cancel_reason: z.string().max(500).nullable().optional(),
  cancelled_by:  z.string().uuid().optional(), // service-seitig befüllt
});

export const trainingBookingFilterSchema = z.object({
  session_id:   z.string().uuid().optional(),
  requester_id: z.string().uuid().optional(),
  partner_id:   z.string().uuid().optional(),
  status:       bookingStatusSchema.optional(),
  /** Alle Buchungen, in denen member_id als requester ODER partner vorkommt. */
  member_id:    z.string().uuid().optional(),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type TrainingSessionCreateInput  = z.infer<typeof trainingSessionCreateSchema>;
export type TrainingSessionUpdateInput  = z.infer<typeof trainingSessionUpdateSchema>;
export type TrainingSessionFilterInput  = z.infer<typeof trainingSessionFilterSchema>;
export type TrainingBookingCreateInput  = z.infer<typeof trainingBookingCreateSchema>;
export type TrainingBookingUpdateInput  = z.infer<typeof trainingBookingUpdateSchema>;
export type TrainingBookingFilterInput  = z.infer<typeof trainingBookingFilterSchema>;
