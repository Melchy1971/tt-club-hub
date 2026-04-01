import { z } from 'zod';

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

// ─── Training-Booking ─────────────────────────────────────────────────────────

export const trainingBookingCreateSchema = z
  .object({
    requester_id: z.string().uuid('Ungültige Mitglieds-ID'),
    partner_id:   z.string().uuid('Ungültige Partner-ID'),
    booking_date: z.string().min(1, 'Datum ist erforderlich'),
    start_time:   z.string().min(1, 'Startzeit ist erforderlich'),
    end_time:     z.string().nullable().optional(),
    location:     z.string().max(200).nullable().optional(),
    note:         z.string().max(500, 'Notiz max. 500 Zeichen').nullable().optional(),
  })
  .refine(
    (d) => d.partner_id !== d.requester_id,
    {
      message: 'Anfragender und Partner müssen unterschiedliche Personen sein',
      path: ['partner_id'],
    },
  );

export const trainingBookingUpdateSchema = z.object({
  status:     bookingStatusSchema.optional(),
  location:   z.string().max(200).nullable().optional(),
  note:       z.string().max(500).nullable().optional(),
  start_time: z.string().optional(),
  end_time:   z.string().nullable().optional(),
}).partial();

export const trainingBookingFilterSchema = z.object({
  requester_id: z.string().uuid().optional(),
  partner_id:   z.string().uuid().optional(),
  status:       bookingStatusSchema.optional(),
  member_id:    z.string().uuid().optional(),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type TrainingBookingCreateInput = z.infer<typeof trainingBookingCreateSchema>;
export type TrainingBookingUpdateInput = z.infer<typeof trainingBookingUpdateSchema>;
export type TrainingBookingFilterInput = z.infer<typeof trainingBookingFilterSchema>;
