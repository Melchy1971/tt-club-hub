/**
 * trainingService
 *
 * Verwaltet training_bookings (Trainingspartner-Buchungen).
 */

import { supabase } from '@/integrations/supabase/client';

// ── Typen ─────────────────────────────────────────────────────

export interface TrainingBookingRow {
  id: string;
  requester_id: string;
  partner_id: string;
  booking_date: string;
  start_time: string;
  end_time: string | null;
  status: 'pending' | 'confirmed' | 'cancelled';
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
  status: 'pending' | 'confirmed' | 'cancelled';
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
    id:           row.id,
    requesterId:  row.requester_id,
    partnerId:    row.partner_id,
    bookingDate:  row.booking_date,
    startTime:    row.start_time,
    endTime:      row.end_time,
    status:       row.status,
    location:     row.location,
    note:         row.note,
    createdBy:    row.created_by,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
    requesterName: row.requester
      ? `${row.requester.first_name} ${row.requester.last_name}`.trim()
      : undefined,
    partnerName: row.partner
      ? `${row.partner.first_name} ${row.partner.last_name}`.trim()
      : undefined,
  };
}

const SELECT_WITH_JOINS = `
  *,
  requester:members!training_bookings_requester_id_fkey(first_name, last_name),
  partner:members!training_bookings_partner_id_fkey(first_name, last_name)
`;

// ── Service ───────────────────────────────────────────────────

export const trainingService = {
  async list(memberId?: string): Promise<TrainingBookingUI[]> {
    let q = supabase
      .from('training_bookings')
      .select(SELECT_WITH_JOINS)
      .order('booking_date', { ascending: false });

    if (memberId) {
      q = q.or(`requester_id.eq.${memberId},partner_id.eq.${memberId}`);
    }

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

  async create(payload: {
    requester_id: string;
    partner_id: string;
    booking_date: string;
    start_time: string;
    end_time?: string | null;
    location?: string | null;
    note?: string | null;
    created_by: string;
  }): Promise<TrainingBookingUI> {
    const { data, error } = await supabase
      .from('training_bookings')
      .insert(payload)
      .select(SELECT_WITH_JOINS)
      .single();
    if (error) throw new Error(`[trainingService] create: ${error.message}`);
    return toUI(data);
  },

  async updateStatus(id: string, status: 'pending' | 'confirmed' | 'cancelled'): Promise<TrainingBookingUI> {
    const { data, error } = await supabase
      .from('training_bookings')
      .update({ status })
      .eq('id', id)
      .select(SELECT_WITH_JOINS)
      .single();
    if (error) throw new Error(`[trainingService] updateStatus: ${error.message}`);
    return toUI(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('training_bookings')
      .delete()
      .eq('id', id);
    if (error) throw new Error(`[trainingService] remove: ${error.message}`);
  },
};
