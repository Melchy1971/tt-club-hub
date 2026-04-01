import { describe, expect, it } from 'vitest';
import {
  isValidBookingTransition,
  trainingBookingCreateSchema,
  trainingBookingUpdateSchema,
} from '@/schemas/training.schema';

const basePayload = {
  requester_id: '11111111-1111-4111-8111-111111111111',
  partner_id: '22222222-2222-4222-8222-222222222222',
  booking_date: '2026-04-10',
  start_time: '18:30',
  end_time: '20:00',
  created_by: '33333333-3333-4333-8333-333333333333',
};

describe('trainingBookingCreateSchema', () => {
  it('normalisiert optionale Textfelder auf null', () => {
    const parsed = trainingBookingCreateSchema.parse({
      ...basePayload,
      location: ' ',
      note: '',
    });

    expect(parsed.location).toBeNull();
    expect(parsed.note).toBeNull();
  });

  it('lehnt gleiche requester_id und partner_id ab', () => {
    const result = trainingBookingCreateSchema.safeParse({
      ...basePayload,
      partner_id: basePayload.requester_id,
    });

    expect(result.success).toBe(false);
  });

  it('lehnt ungültiges Zeitfenster ab', () => {
    const result = trainingBookingCreateSchema.safeParse({
      ...basePayload,
      end_time: '18:30',
    });

    expect(result.success).toBe(false);
  });
});

describe('trainingBookingUpdateSchema', () => {
  it('akzeptiert status-only updates', () => {
    const result = trainingBookingUpdateSchema.safeParse({ status: 'confirmed' });
    expect(result.success).toBe(true);
  });
});

describe('booking transition matrix', () => {
  it('erlaubt pending -> confirmed', () => {
    expect(isValidBookingTransition('pending', 'confirmed')).toBe(true);
  });

  it('verbietet cancelled -> pending', () => {
    expect(isValidBookingTransition('cancelled', 'pending')).toBe(false);
  });
});
