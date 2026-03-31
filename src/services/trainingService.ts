/**
 * trainingService
 *
 * Simplified service for training_bookings table.
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { errors, fromSupabaseError } from '@/lib/error';
import type { ApiResult } from '@/types/api';

export interface TrainingBookingRow {
  id: string;
  requester_id: string;
  partner_id: string;
  booking_date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  status: 'pending' | 'confirmed' | 'cancelled';
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const trainingService = {
  async listBookings(): Promise<ApiResult<TrainingBookingRow[]>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('training_bookings')
        .select('*')
        .order('booking_date', { ascending: false })
        .order('start_time', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TrainingBookingRow[];
    }, (e) => fromSupabaseError(e));
  },

  async createBooking(input: Omit<TrainingBookingRow, 'id' | 'created_at' | 'updated_at' | 'status'>): Promise<ApiResult<TrainingBookingRow>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('training_bookings')
        .insert(input)
        .select('*')
        .single();
      if (error) throw error;
      return data as TrainingBookingRow;
    }, (e) => fromSupabaseError(e));
  },

  async updateBooking(id: string, updates: Partial<TrainingBookingRow>): Promise<ApiResult<TrainingBookingRow>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('training_bookings')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data as TrainingBookingRow;
    }, (e) => fromSupabaseError(e));
  },

  async deleteBooking(id: string): Promise<ApiResult<void>> {
    return tryCatch(async () => {
      const { error } = await supabase
        .from('training_bookings')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }, (e) => fromSupabaseError(e));
  },
};
