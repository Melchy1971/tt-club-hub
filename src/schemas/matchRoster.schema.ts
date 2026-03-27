import { z } from 'zod';

export const availabilityStatusSchema = z.enum(['available', 'maybe', 'unavailable']);

export const matchAvailabilitySchema = z.object({
  match_id: z.string().uuid(),
  member_id: z.string().uuid(),
  status: availabilityStatusSchema,
  note: z.string().max(500).nullable().optional(),
});

export const matchLineupSlotSchema = z.object({
  match_id: z.string().uuid(),
  member_id: z.string().uuid(),
  position: z.number().int().positive(),
  is_substitute: z.boolean().default(false),
});

export const matchLineupBulkSchema = z.object({
  match_id: z.string().uuid(),
  slots: z.array(matchLineupSlotSchema.omit({ match_id: true })),
});

export type AvailabilityStatus = z.infer<typeof availabilityStatusSchema>;
export type MatchAvailabilityInput = z.infer<typeof matchAvailabilitySchema>;
export type MatchLineupSlot = z.infer<typeof matchLineupSlotSchema>;
export type MatchLineupBulkInput = z.infer<typeof matchLineupBulkSchema>;
