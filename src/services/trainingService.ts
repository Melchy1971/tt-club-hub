/**
 * trainingService
 *
 * Domain für 1:1-Trainingsbuchungen (nicht Team-Trainingszeiten).
 * Team-Trainingsslots liegen in training_sessions/team_schedule und werden bewusst separat geführt.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  isValidBookingTransition,
  trainingBookingCreateSchema,
  trainingBookingFilterSchema,
  trainingBookingUpdateSchema,
  type BookingStatus,
  type TrainingBookingCreateInput,
  type TrainingBookingFilterInput,
  type TrainingBookingUpdateInput,
} from '@/schemas/training.schema';

export interface TrainingBookingRow {
  id: string;
  requester_id: string;
  partner_id: string;
  booking_date: string;
  start_time: string;
  end_time: string | null;
  status: BookingStatus;
  location: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingBookingUI {
  id: string;
  requesterId: string;
  partnerId: string;
  bookingDate: string;
  startTime: string;
  endTime: string | null;
  status: BookingStatus;
  location: string | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  requesterName?: string;
  partnerName?: string;
}

function toUI(row: any): TrainingBookingUI {
  return {
    id: row.id,
    requesterId: row.requester_id,
    partnerId: row.partner_id,
    bookingDate: row.booking_date,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    location: row.location,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    requesterName: row.requester ? `${row.requester.first_name} ${row.requester.last_name}`.trim() : undefined,
    partnerName: row.partner ? `${row.partner.first_name} ${row.partner.last_name}`.trim() : undefined,
  };
}

const SELECT_WITH_JOINS = `
  *,
  requester:members!training_bookings_requester_id_fkey(first_name, last_name, is_active),
  partner:members!training_bookings_partner_id_fkey(first_name, last_name, is_active)
`;

function overlaps(aStart: string, aEnd: string | null, bStart: string, bEnd: string | null): boolean {
  const normalizeEnd = (start: string, end: string | null) => end ?? start;
  return aStart < normalizeEnd(bStart, bEnd) && bStart < normalizeEnd(aStart, aEnd);
}

async function assertMembersBookable(requesterId: string, partnerId: string): Promise<void> {
  const { data, error } = await supabase
    .from('members')
    .select('id, is_active')
    .in('id', [requesterId, partnerId]);

  if (error) throw new Error(`[trainingService] member validation failed: ${error.message}`);

  const map = new Map((data ?? []).map((m) => [m.id, m.is_active]));
  if (!map.has(requesterId) || !map.has(partnerId)) {
    throw new Error('Requester oder Partner existiert nicht.');
  }
  if (!map.get(requesterId) || !map.get(partnerId)) {
    throw new Error('Requester und Partner müssen aktive Mitglieder sein.');
  }
}

async function assertNoMemberDoubleBooking(
  payload: Pick<TrainingBookingCreateInput, 'requester_id' | 'partner_id' | 'booking_date' | 'start_time' | 'end_time'>,
  ignoreId?: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('training_bookings')
    .select('id, requester_id, partner_id, start_time, end_time, status')
    .eq('booking_date', payload.booking_date)
    .in('status', ['pending', 'confirmed']);

  if (error) throw new Error(`[trainingService] conflict check failed: ${error.message}`);

  const conflicts = (data ?? []).filter((row) => {
    if (ignoreId && row.id === ignoreId) return false;
    const memberOverlap =
      [row.requester_id, row.partner_id].includes(payload.requester_id) ||
      [row.requester_id, row.partner_id].includes(payload.partner_id);

    return memberOverlap && overlaps(payload.start_time, payload.end_time, row.start_time, row.end_time);
  });

  if (conflicts.length > 0) {
    throw new Error('Doppelbuchung erkannt: Mindestens ein Mitglied ist im Zeitraum bereits gebucht.');
  }
}

export const trainingService = {
  async list(filters?: TrainingBookingFilterInput): Promise<TrainingBookingUI[]> {
    const parsed = filters ? trainingBookingFilterSchema.parse(filters) : undefined;

    let q = supabase
      .from('training_bookings')
      .select(SELECT_WITH_JOINS)
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: true });

    if (parsed?.member_id) {
      q = q.or(`requester_id.eq.${parsed.member_id},partner_id.eq.${parsed.member_id}`);
    }
    if (parsed?.requester_id) q = q.eq('requester_id', parsed.requester_id);
    if (parsed?.partner_id) q = q.eq('partner_id', parsed.partner_id);
    if (parsed?.status) q = q.eq('status', parsed.status);
    if (parsed?.booking_date) q = q.eq('booking_date', parsed.booking_date);

    const { data, error } = await q;
    if (error) throw new Error(`[trainingService] list: ${error.message}`);
    return (data ?? []).map(toUI);
  },

  async getById(id: string): Promise<TrainingBookingUI | null> {
    const { data, error } = await supabase
      .from('training_bookings')
      .select(SELECT_WITH_JOINS)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`[trainingService] getById: ${error.message}`);
    return data ? toUI(data) : null;
  },

  async create(payload: TrainingBookingCreateInput): Promise<TrainingBookingUI> {
    const input = trainingBookingCreateSchema.parse(payload);

    await assertMembersBookable(input.requester_id, input.partner_id);
    await assertNoMemberDoubleBooking(input);

    const { data, error } = await supabase
      .from('training_bookings')
      .insert(input)
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) throw new Error(`[trainingService] create: ${error.message}`);
    return toUI(data);
  },

  async update(id: string, payload: TrainingBookingUpdateInput): Promise<TrainingBookingUI> {
    const updates = trainingBookingUpdateSchema.parse(payload);

    const existing = await this.getById(id);
    if (!existing) throw new Error('Buchung wurde nicht gefunden.');

    if (updates.status && !isValidBookingTransition(existing.status, updates.status)) {
      throw new Error(`Ungültiger Statuswechsel: ${existing.status} -> ${updates.status}`);
    }

    const nextStart = updates.start_time ?? existing.startTime;
    const nextEnd = updates.end_time === undefined ? existing.endTime : updates.end_time;

    await assertNoMemberDoubleBooking(
      {
        requester_id: existing.requesterId,
        partner_id: existing.partnerId,
        booking_date: existing.bookingDate,
        start_time: nextStart,
        end_time: nextEnd,
      },
      id,
    );

    const { data, error } = await supabase
      .from('training_bookings')
      .update(updates)
      .eq('id', id)
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) throw new Error(`[trainingService] update: ${error.message}`);
    return toUI(data);
  },

  async updateStatus(id: string, status: BookingStatus): Promise<TrainingBookingUI> {
    return this.update(id, { status });
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('training_bookings').delete().eq('id', id);
    if (error) throw new Error(`[trainingService] remove: ${error.message}`);
  },
};
