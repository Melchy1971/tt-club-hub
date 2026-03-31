import { z } from 'zod';

export const BOOKING_STATUSES = ['pending', 'confirmed', 'waitlisted', 'cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const VALID_BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending:    ['confirmed', 'waitlisted', 'cancelled'],
  confirmed:  ['cancelled'],
  waitlisted: ['confirmed', 'cancelled'],
  cancelled:  [],
};

// ─── Training Session ─────────────────────────────────────────────────────────

export const trainingSessionCreateSchema = z
  .object({
    team_id:          z.string().uuid().nullable().optional(),
    venue_id:         z.string().uuid().nullable().optional(),
    title:            z.string().max(200).nullable().optional(),
    description:      z.string().max(1000).nullable().optional(),
    start_ts:         z.string().datetime(),
    end_ts:           z.string().datetime(),
    max_participants: z.number().int().min(1).max(100).nullable().optional(),
    notes:            z.string().max(1000).nullable().optional(),
  })
  .refine((d) => new Date(d.end_ts) > new Date(d.start_ts), {
    message: 'Endzeit muss nach der Startzeit liegen',
    path: ['end_ts'],
  });

export const trainingSessionUpdateSchema = trainingSessionCreateSchema.partial();

// ─── Training Booking ─────────────────────────────────────────────────────────

export const trainingBookingCreateSchema = z
  .object({
    session_id:   z.string().uuid(),
    requester_id: z.string().uuid(),
    partner_id:   z.string().uuid().nullable().optional(),
    note:         z.string().max(500).nullable().optional(),
  })
  .refine(
    (d) => !d.partner_id || d.partner_id !== d.requester_id,
    { message: 'Requester und Partner müssen unterschiedliche Personen sein', path: ['partner_id'] },
  );
