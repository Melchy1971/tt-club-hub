import { z } from 'zod';

// ─── Booking-Status ───────────────────────────────────────────────────────────

export const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const bookingStatusSchema = z.enum(BOOKING_STATUSES);

export const trainingBookingCreateSchema = z.object({
  requester_id: z.string().uuid('Ungültige Mitglieds-ID'),
  partner_id: z.string().uuid('Ungültige Partner-ID'),
  booking_date: z.string().min(1, 'Datum erforderlich'),
  start_time: z.string().min(1, 'Startzeit erforderlich'),
  end_time: z.string().nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  created_by: z.string().uuid(),
}).refine(
  (d) => d.partner_id !== d.requester_id,
  { message: 'Anfragender und Partner müssen unterschiedlich sein', path: ['partner_id'] },
);

export const trainingBookingUpdateSchema = trainingBookingCreateSchema
  .innerType()
  .partial()
  .extend({ status: bookingStatusSchema.optional() });

export type TrainingBookingCreateInput = z.infer<typeof trainingBookingCreateSchema>;
export type TrainingBookingUpdateInput = z.infer<typeof trainingBookingUpdateSchema>;
