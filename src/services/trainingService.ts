/**
 * trainingService
 *
 * Verwaltet training_sessions und training_bookings.
 *
 * Buchungs-Status: pending | confirmed | waitlisted | cancelled
 *
 * Konsistenzregeln (service-seitig, redundant zu DB-Triggern):
 *   – requester_id ≠ partner_id
 *   – Keine Doppelbuchung: requester bereits pending/confirmed/waitlisted für Session
 *   – Keine Partner-Kollision: partner bereits als requester oder partner aktiv
 *   – Session muss aktiv und in der Zukunft liegen
 *   – Kapazitätsgrenze → auto-waitlist
 *   – Stornierung einer confirmed-Buchung → älteste Warteliste nachrücken (FIFO)
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  TrainingSession,
  TrainingSessionInsert,
  TrainingSessionUpdate,
  TrainingBooking,
  TrainingBookingInsert,
  BookingStatus,
} from '@/types';

// ─── Interne Hilfsfunktionen ──────────────────────────────────────────────────

/** Aktive Status – zählen für Kapazität und Konflikt-Checks. */
const ACTIVE_STATUSES: BookingStatus[] = ['pending', 'confirmed', 'waitlisted'];

/**
 * Rückt nach einer Stornierung den ältesten Wartelisten-Eintrag nach (FIFO).
 * Kein Fehler wenn Warteliste leer oder Session unbegrenzt.
 */
async function promoteWaitlist(sessionId: string): Promise<void> {
  const { data: session } = await supabase
    .from('training_sessions')
    .select('max_participants')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session?.max_participants) return; // unbegrenzt

  const { count: activeCount } = await supabase
    .from('training_bookings')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .in('status', ['pending', 'confirmed']);

  if ((activeCount ?? 0) >= session.max_participants) return; // immer noch voll

  const { data: next } = await supabase
    .from('training_bookings')
    .select('id')
    .eq('session_id', sessionId)
    .eq('status', 'waitlisted')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!next) return;

  await supabase
    .from('training_bookings')
    .update({ status: 'confirmed' })
    .eq('id', next.id);
}

/**
 * Prüft Konflikte bevor eine Buchung angelegt wird.
 * Wirft einen Error bei Verstoß.
 */
async function assertNoBookingConflicts(input: {
  session_id: string;
  requester_id: string;
  partner_id?: string | null;
}): Promise<void> {
  const { session_id, requester_id, partner_id } = input;

  if (partner_id && partner_id === requester_id) {
    throw new Error('Requester und Partner müssen unterschiedliche Personen sein');
  }

  // Session validieren
  const { data: session } = await supabase
    .from('training_sessions')
    .select('is_cancelled, end_ts')
    .eq('id', session_id)
    .maybeSingle();

  if (!session) throw new Error(`Training-Session nicht gefunden`);
  if (session.is_cancelled) throw new Error('Training-Session ist storniert');
  if (new Date(session.end_ts) < new Date()) throw new Error('Training-Session hat bereits stattgefunden');

  // Requester bereits gebucht?
  const { data: existingReq } = await supabase
    .from('training_bookings')
    .select('status')
    .eq('session_id', session_id)
    .eq('requester_id', requester_id)
    .in('status', ACTIVE_STATUSES)
    .maybeSingle();

  if (existingReq) {
    throw new Error(`Mitglied ist bereits mit Status "${existingReq.status}" für diese Session gebucht`);
  }

  // Requester als partner einer anderen Buchung?
  const { data: reqAsPartner } = await supabase
    .from('training_bookings')
    .select('id')
    .eq('session_id', session_id)
    .eq('partner_id', requester_id)
    .in('status', ACTIVE_STATUSES)
    .maybeSingle();

  if (reqAsPartner) {
    throw new Error('Mitglied ist bereits als Partner einer anderen Buchung für diese Session eingetragen');
  }

  if (partner_id) {
    // Partner bereits als requester gebucht?
    const { data: partnerAsReq } = await supabase
      .from('training_bookings')
      .select('id')
      .eq('session_id', session_id)
      .eq('requester_id', partner_id)
      .in('status', ACTIVE_STATUSES)
      .maybeSingle();

    if (partnerAsReq) {
      throw new Error('Der Partner ist für diese Session bereits als eigenständiger Teilnehmer gebucht');
    }

    // Partner bereits als partner einer anderen Buchung?
    const { data: partnerAsPartner } = await supabase
      .from('training_bookings')
      .select('id')
      .eq('session_id', session_id)
      .eq('partner_id', partner_id)
      .in('status', ACTIVE_STATUSES)
      .maybeSingle();

    if (partnerAsPartner) {
      throw new Error('Der Partner ist für diese Session bereits als Partner einer anderen Buchung eingetragen');
    }
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const trainingService = {
  // ── Sessions ────────────────────────────────────────────────────────────────

  async listSessions(options: {
    teamId?: string;
    venueId?: string;
    upcomingOnly?: boolean;
    includeCancelled?: boolean;
  } = {}): Promise<TrainingSession[]> {
    let q = supabase.from('training_sessions').select('*');

    if (options.teamId)  q = q.eq('team_id', options.teamId);
    if (options.venueId) q = q.eq('venue_id', options.venueId);
    if (options.upcomingOnly)    q = q.gte('start_ts', new Date().toISOString());
    if (!options.includeCancelled) q = q.eq('is_cancelled', false);

    const { data, error } = await q.order('start_ts', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getSession(id: string): Promise<TrainingSession | null> {
    const { data, error } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async createSession(input: TrainingSessionInsert): Promise<TrainingSession> {
    if (new Date(input.end_ts) <= new Date(input.start_ts)) {
      throw new Error('Endzeit muss nach der Startzeit liegen');
    }
    const { data, error } = await supabase
      .from('training_sessions')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateSession(id: string, updates: TrainingSessionUpdate): Promise<TrainingSession> {
    if (updates.start_ts && updates.end_ts) {
      if (new Date(updates.end_ts) <= new Date(updates.start_ts)) {
        throw new Error('Endzeit muss nach der Startzeit liegen');
      }
    }
    const { data, error } = await supabase
      .from('training_sessions')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Storniert die Session und alle offenen Buchungen darin.
   * Gibt die Anzahl stornierter Buchungen zurück.
   */
  async cancelSession(id: string, cancelledBy: string, reason?: string): Promise<number> {
    const { error: sessionError } = await supabase
      .from('training_sessions')
      .update({ is_cancelled: true })
      .eq('id', id);
    if (sessionError) throw sessionError;

    const { data, error: bookingError } = await supabase
      .from('training_bookings')
      .update({
        status:        'cancelled',
        cancel_reason: reason ?? 'Session storniert',
        cancelled_by:  cancelledBy,
      })
      .eq('session_id', id)
      .in('status', ACTIVE_STATUSES)
      .select('id');
    if (bookingError) throw bookingError;

    return (data ?? []).length;
  },

  // ── Bookings ────────────────────────────────────────────────────────────────

  async listBookings(options: {
    sessionId?: string;
    requesterId?: string;
    partnerId?: string;
    /** Alle Buchungen, in denen memberId als requester ODER partner vorkommt */
    memberId?: string;
    status?: BookingStatus;
  } = {}): Promise<TrainingBooking[]> {
    let q = supabase.from('training_bookings').select('*');

    if (options.sessionId)   q = q.eq('session_id', options.sessionId);
    if (options.requesterId) q = q.eq('requester_id', options.requesterId);
    if (options.partnerId)   q = q.eq('partner_id', options.partnerId);
    if (options.status)      q = q.eq('status', options.status);
    if (options.memberId) {
      q = q.or(`requester_id.eq.${options.memberId},partner_id.eq.${options.memberId}`);
    }

    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getBooking(id: string): Promise<TrainingBooking | null> {
    const { data, error } = await supabase
      .from('training_bookings')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /**
   * Neue Buchung anlegen.
   * Kapazität voll → status wird automatisch auf 'waitlisted' gesetzt.
   */
  async book(input: TrainingBookingInsert, bookedBy: string): Promise<TrainingBooking> {
    await assertNoBookingConflicts({
      session_id:   input.session_id,
      requester_id: input.requester_id,
      partner_id:   input.partner_id,
    });

    // Kapazitätsprüfung → auto-waitlist
    let status: BookingStatus = input.status ?? 'pending';
    const { data: session } = await supabase
      .from('training_sessions')
      .select('max_participants')
      .eq('id', input.session_id)
      .maybeSingle();

    if (session?.max_participants) {
      const { count } = await supabase
        .from('training_bookings')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', input.session_id)
        .in('status', ACTIVE_STATUSES);

      if ((count ?? 0) >= session.max_participants) {
        status = 'waitlisted';
      }
    }

    const { data, error } = await supabase
      .from('training_bookings')
      .insert({ ...input, status, booked_by: bookedBy })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Buchungs-Status ändern.
   * Erlaubte Übergänge:
   *   pending    → confirmed | waitlisted | cancelled
   *   confirmed  → cancelled
   *   waitlisted → confirmed | cancelled
   *   cancelled  → (terminal)
   */
  async updateStatus(
    id: string,
    newStatus: BookingStatus,
    cancelledBy?: string,
    cancelReason?: string,
  ): Promise<TrainingBooking> {
    const VALID: Record<BookingStatus, BookingStatus[]> = {
      pending:    ['confirmed', 'waitlisted', 'cancelled'],
      confirmed:  ['cancelled'],
      waitlisted: ['confirmed', 'cancelled'],
      cancelled:  [],
    };

    const current = await trainingService.getBooking(id);
    if (!current) throw new Error(`Buchung "${id}" nicht gefunden`);
    if (!VALID[current.status].includes(newStatus)) {
      throw new Error(`Übergang von "${current.status}" nach "${newStatus}" ist nicht erlaubt`);
    }

    const patch: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'cancelled') {
      patch.cancelled_by  = cancelledBy ?? null;
      patch.cancel_reason = cancelReason ?? null;
      patch.cancelled_at  = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('training_bookings')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    // Warteliste nach Stornierung aufwerten (FIFO)
    if (newStatus === 'cancelled') {
      await promoteWaitlist(current.session_id);
    }

    return data;
  },

  async confirmBooking(id: string): Promise<TrainingBooking> {
    return trainingService.updateStatus(id, 'confirmed');
  },

  async cancelBooking(id: string, cancelledBy: string, reason?: string): Promise<TrainingBooking> {
    return trainingService.updateStatus(id, 'cancelled', cancelledBy, reason);
  },

  /**
   * Wartelisten-Position eines Mitglieds für eine Session (1-basiert).
   * Gibt null zurück wenn nicht auf der Warteliste.
   */
  async getWaitlistPosition(sessionId: string, requesterId: string): Promise<number | null> {
    const { data, error } = await supabase
      .from('training_bookings')
      .select('requester_id, created_at')
      .eq('session_id', sessionId)
      .eq('status', 'waitlisted')
      .order('created_at', { ascending: true });
    if (error) throw error;
    const pos = (data ?? []).findIndex((r) => r.requester_id === requesterId);
    return pos === -1 ? null : pos + 1;
  },

  /**
   * Anzahl freier Plätze für eine Session.
   * Gibt null zurück wenn die Session keine Kapazitätsgrenze hat.
   */
  async getSpotsAvailable(sessionId: string): Promise<number | null> {
    const { data: session } = await supabase
      .from('training_sessions')
      .select('max_participants')
      .eq('id', sessionId)
      .maybeSingle();
    if (!session?.max_participants) return null;

    const { count } = await supabase
      .from('training_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .in('status', ACTIVE_STATUSES);

    return Math.max(0, session.max_participants - (count ?? 0));
  },
};
