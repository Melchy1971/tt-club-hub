import { z } from 'zod';

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

export const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const bookingStatusSchema = z.enum(BOOKING_STATUSES);

/** Terminale Status – kein weiterer Übergang möglich. */
export const TERMINAL_BOOKING_STATUSES = new Set<BookingStatus>(['cancelled']);

/** Erlaubte Status-Übergänge. */
export const VALID_BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['cancelled'],
  cancelled: [],
};

export function isValidBookingTransition(from: BookingStatus, to: BookingStatus): boolean {
  return VALID_BOOKING_TRANSITIONS[from].includes(to);
}

export const trainingBookingCreateSchema = z
  .object({
    requester_id: z.string().uuid('Ungültige requester_id'),
    partner_id: z.string().uuid('Ungültige partner_id'),
    booking_date: isoDateSchema,
    start_time: hhmmSchema,
    end_time: z
      .union([hhmmSchema, z.null(), z.undefined()])
      .transform((v) => v ?? null),
    location: nullableText(200, 'Ort'),
    note: nullableText(500, 'Notiz'),
    created_by: z.string().uuid('Ungültige created_by'),
  })
  .superRefine((d, ctx) => {
    if (d.partner_id === d.requester_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'requester_id und partner_id müssen unterschiedlich sein',
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

export const trainingBookingUpdateSchema = z
  .object({
    status: bookingStatusSchema.optional(),
    location: nullableText(200, 'Ort').optional(),
    note: nullableText(500, 'Notiz').optional(),
    start_time: hhmmSchema.optional(),
    end_time: z.union([hhmmSchema, z.null()]).optional(),
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

export const trainingBookingFilterSchema = z.object({
  requester_id: z.string().uuid().optional(),
  partner_id: z.string().uuid().optional(),
  status: bookingStatusSchema.optional(),
  member_id: z.string().uuid().optional(),
  booking_date: isoDateSchema.optional(),
});

export type TrainingBookingCreateInput = z.infer<typeof trainingBookingCreateSchema>;
export type TrainingBookingUpdateInput = z.infer<typeof trainingBookingUpdateSchema>;
export type TrainingBookingFilterInput = z.infer<typeof trainingBookingFilterSchema>;
