/**
 * trainingService
 *
 * Verwaltet individuelle 1:1-Trainingsbuchungen (training_bookings).
 * Team-Trainingsslots (Stammdaten) → teamTrainingSlotService.
 *
 * Statusworkflow:
 *   pending ──► confirmed ──► cancelled (terminal)
 *           └──► cancelled              (terminal)
 *
 * Konflikt-Prävention:
 *   1. Selbstbuchung: requester_id === partner_id → Schema-Fehler
 *   2. Inaktive Mitglieder: is_active muss true sein für beide
 *   3. Doppelbuchung: Zeitüberschneidung für dasselbe Mitglied am selben Tag
 *   4. Vergangene Termine: booking_date < heute → unveränderlich
 *   5. Ungültiger Übergang: VALID_BOOKING_TRANSITIONS
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { errors, fromSupabaseError } from '@/lib/error';
import { todayISO } from '@/lib/date';
import type { ApiResult } from '@/types/api';
import type { TrainingBooking, TrainingBookingUI } from '@/types/domain/training';
import {
  isValidBookingTransition,
  isTerminalBookingStatus,
  trainingBookingCreateSchema,
  trainingBookingUpdateSchema,
  trainingBookingFilterSchema,
  type BookingStatus,
  type TrainingBookingCreateInput,
  type TrainingBookingUpdateInput,
  type TrainingBookingFilterInput,
} from '@/schemas/training.schema';

// ─── Select-String ─────────────────────────────────────────────────────────────

const SELECT_WITH_JOINS = `
  *,
  requester:members!training_bookings_requester_id_fkey(first_name, last_name, is_active),
  partner:members!training_bookings_partner_id_fkey(first_name, last_name, is_active)
`.trim();

// ─── Mapping ───────────────────────────────────────────────────────────────────

function toUI(row: any): TrainingBookingUI {
  const today = todayISO();
  return {
    id:           row.id,
    requester_id: row.requester_id,
    partner_id:   row.partner_id,
    booking_date: row.booking_date,
    start_time:   row.start_time,
    end_time:     row.end_time,
    status:       row.status,
    location:     row.location,
    note:         row.note,
    created_by:   row.created_by,
    created_at:   row.created_at,
    updated_at:   row.updated_at,
    requester: row.requester
      ? { first_name: row.requester.first_name, last_name: row.requester.last_name }
      : null,
    partner: row.partner
      ? { first_name: row.partner.first_name, last_name: row.partner.last_name }
      : null,
    isPast:   row.booking_date < today,
    isToday:  row.booking_date === today,
  } as TrainingBookingUI;
}

// ─── Interne Hilfsfunktionen ───────────────────────────────────────────────────

/**
 * Prüft ob booking_date in der Vergangenheit liegt.
 * Heute gilt als nicht-vergangen (Buchungen können noch storniert werden).
 */
function assertNotPast(bookingDate: string): void {
  if (bookingDate < todayISO()) {
    throw errors.conflict(
      `Buchungen für vergangene Termine (${bookingDate}) sind unveränderlich`,
    );
  }
}

/** Prüft ob beide Mitglieder existieren und aktiv sind. */
async function assertMembersActive(requesterId: string, partnerId: string): Promise<void> {
  const { data, error } = await supabase
    .from('members')
    .select('id, is_active, first_name, last_name')
    .in('id', [requesterId, partnerId]);

  if (error) throw fromSupabaseError(error);

  const map = new Map((data ?? []).map((m) => [m.id, m]));

  const requester = map.get(requesterId);
  const partner   = map.get(partnerId);

  if (!requester) throw errors.notFound('Mitglied (Anfragender)', requesterId);
  if (!partner)   throw errors.notFound('Mitglied (Partner)', partnerId);

  if (!requester.is_active) {
    throw errors.conflict(
      `${requester.first_name} ${requester.last_name} ist kein aktives Mitglied`,
    );
  }
  if (!partner.is_active) {
    throw errors.conflict(
      `${partner.first_name} ${partner.last_name} ist kein aktives Mitglied`,
    );
  }
}

/**
 * Zeitüberschneidung zweier Halboffener Intervalle [aStart, aEnd).
 * Null-end_time wird als Punkt-Buchung behandelt (kein Overlap außer gleichem Start).
 */
function timeOverlaps(
  aStart: string, aEnd: string | null,
  bStart: string, bEnd: string | null,
): boolean {
  // Halboffenes Intervall: [start, end)
  // Bei null-end nehmen wir einen minimalen Slot (nur Punkt), der nicht überlappt
  // außer wenn beide denselben Startpunkt haben.
  const aNormEnd = aEnd ?? aStart;
  const bNormEnd = bEnd ?? bStart;
  return aStart < bNormEnd && bStart < aNormEnd;
}

/**
 * Prüft ob ein Mitglied am gegebenen Tag / Zeitfenster bereits gebucht ist.
 * Vergleicht requester + partner beider Seiten (ein Mitglied kann in beiden Rollen stehen).
 */
async function assertNoDoubleBooking(
  booking: Pick<
    TrainingBookingCreateInput,
    'requester_id' | 'partner_id' | 'booking_date' | 'start_time' | 'end_time'
  >,
  excludeId?: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('training_bookings')
    .select('id, requester_id, partner_id, start_time, end_time, status')
    .eq('booking_date', booking.booking_date)
    .in('status', ['pending', 'confirmed']);

  if (error) throw fromSupabaseError(error);

  const affectedMembers = new Set([booking.requester_id, booking.partner_id]);

  const conflict = (data ?? []).find((row) => {
    if (excludeId && row.id === excludeId) return false;

    const memberOverlap =
      affectedMembers.has(row.requester_id) ||
      affectedMembers.has(row.partner_id);

    return (
      memberOverlap &&
      timeOverlaps(
        booking.start_time,
        booking.end_time ?? null,
        row.start_time,
        row.end_time,
      )
    );
  });

  if (conflict) {
    throw errors.conflict(
      `Doppelbuchung erkannt: Mindestens ein Mitglied hat am ${booking.booking_date} ` +
      `${booking.start_time}–${booking.end_time ?? '?'} bereits eine Buchung (ID: ${conflict.id})`,
    );
  }
}

// ─── Service ───────────────────────────────────────────────────────────────────

export const trainingService = {

  // ── Queries ──────────────────────────────────────────────────────────────────

  /**
   * Listet Buchungen mit optionalem Filter.
   *
   * member_id ist ein OR-Filter (requester_id OR partner_id).
   * upcoming_only und past_only schließen sich gegenseitig aus;
   * bei Konflikt gewinnt upcoming_only.
   */
  async list(filter: TrainingBookingFilterInput = {}): Promise<ApiResult<TrainingBookingUI[]>> {
    const parsed = trainingBookingFilterSchema.safeParse(filter);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.issues));
    }

    const {
      requester_id, partner_id, member_id,
      status, booking_date,
      from_date, to_date,
      upcoming_only, past_only,
    } = parsed.data;

    return tryCatch(async () => {
      let q = supabase
        .from('training_bookings')
        .select(SELECT_WITH_JOINS)
        .order('booking_date', { ascending: false })
        .order('start_time',   { ascending: true  });

      if (member_id) {
        q = q.or(`requester_id.eq.${member_id},partner_id.eq.${member_id}`);
      }
      if (requester_id) q = q.eq('requester_id', requester_id);
      if (partner_id)   q = q.eq('partner_id', partner_id);
      if (status)       q = q.eq('status', status);
      if (booking_date) q = q.eq('booking_date', booking_date);
      if (from_date)    q = q.gte('booking_date', from_date);
      if (to_date)      q = q.lte('booking_date', to_date);

      const today = todayISO();
      if (upcoming_only) q = q.gte('booking_date', today);
      else if (past_only) q = q.lt('booking_date', today);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(toUI);
    }, fromSupabaseError);
  },

  /** Einzelne Buchung mit Joins. */
  async getById(id: string): Promise<ApiResult<TrainingBookingUI>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('training_bookings')
        .select(SELECT_WITH_JOINS)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw { message: `Buchung "${id}" nicht gefunden`, code: 'PGRST116' };
      return toUI(data);
    }, fromSupabaseError);
  },

  /** Alle anstehenden Buchungen eines Mitglieds. */
  async upcoming(memberId: string, limit = 10): Promise<ApiResult<TrainingBookingUI[]>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('training_bookings')
        .select(SELECT_WITH_JOINS)
        .or(`requester_id.eq.${memberId},partner_id.eq.${memberId}`)
        .gte('booking_date', todayISO())
        .in('status', ['pending', 'confirmed'])
        .order('booking_date', { ascending: true })
        .order('start_time',   { ascending: true })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map(toUI);
    }, fromSupabaseError);
  },

  // ── Mutations ─────────────────────────────────────────────────────────────────

  /**
   * Erstellt eine neue Trainingsbuchung.
   *
   * Validierungsreihenfolge:
   *   1. Schema (Zod): Selbstbuchung, Zeitfenster
   *   2. Datum nicht in Vergangenheit
   *   3. Beide Mitglieder aktiv
   *   4. Kein Zeitkonflikt am selben Tag
   */
  async create(input: TrainingBookingCreateInput): Promise<ApiResult<TrainingBookingUI>> {
    const parsed = trainingBookingCreateSchema.safeParse(input);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.issues));
    }

    return tryCatch(async () => {
      // ── 1. Vergangene Termine blockieren ──────────────────────────────────────
      assertNotPast(parsed.data.booking_date);

      // ── 2. Mitglieder aktiv? ──────────────────────────────────────────────────
      await assertMembersActive(parsed.data.requester_id, parsed.data.partner_id);

      // ── 3. Doppelbuchung? ─────────────────────────────────────────────────────
      await assertNoDoubleBooking(parsed.data);

      // ── 4. Einfügen ───────────────────────────────────────────────────────────
      const { data, error } = await supabase
        .from('training_bookings')
        .insert(parsed.data)
        .select(SELECT_WITH_JOINS)
        .single();
      if (error) throw error;
      return toUI(data);
    }, fromSupabaseError);
  },

  /**
   * Aktualisiert eine Buchung.
   *
   * Nicht änderbar: booking_date, requester_id, partner_id.
   * Vergangene Buchungen sind vollständig gesperrt.
   */
  async update(id: string, input: TrainingBookingUpdateInput): Promise<ApiResult<TrainingBookingUI>> {
    const parsed = trainingBookingUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.issues));
    }

    return tryCatch(async () => {
      // Aktuelle Buchung laden
      const { data: existing, error: fetchErr } = await supabase
        .from('training_bookings')
        .select('id, status, booking_date, requester_id, partner_id, start_time, end_time')
        .eq('id', id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!existing) throw errors.notFound('Buchung', id);

      // ── Vergangene Buchungen sind unveränderlich ───────────────────────────────
      assertNotPast(existing.booking_date);

      // ── Terminale Status ──────────────────────────────────────────────────────
      if (isTerminalBookingStatus(existing.status as BookingStatus)) {
        throw errors.conflict(
          `Buchung ist im terminalen Status "${existing.status}" und kann nicht geändert werden`,
        );
      }

      // ── Statusübergang validieren ─────────────────────────────────────────────
      if (parsed.data.status) {
        const from = existing.status as BookingStatus;
        const to   = parsed.data.status;
        if (!isValidBookingTransition(from, to)) {
          throw errors.conflict(
            `Statusübergang "${from}" → "${to}" ist nicht erlaubt`,
          );
        }
      }

      // ── Zeitkonflikt bei Zeitänderung prüfen ──────────────────────────────────
      const nextStart = parsed.data.start_time ?? existing.start_time;
      const nextEnd   = parsed.data.end_time !== undefined
        ? parsed.data.end_time
        : existing.end_time;

      if (parsed.data.start_time || parsed.data.end_time !== undefined) {
        await assertNoDoubleBooking(
          {
            requester_id: existing.requester_id,
            partner_id:   existing.partner_id,
            booking_date: existing.booking_date,
            start_time:   nextStart,
            end_time:     nextEnd,
          },
          id,
        );
      }

      const { data, error } = await supabase
        .from('training_bookings')
        .update(parsed.data)
        .eq('id', id)
        .select(SELECT_WITH_JOINS)
        .single();
      if (error) throw error;
      return toUI(data);
    }, fromSupabaseError);
  },

  /** Buchung bestätigen (pending → confirmed). */
  async confirm(id: string): Promise<ApiResult<TrainingBookingUI>> {
    return this.update(id, { status: 'confirmed' });
  },

  /** Buchung stornieren (pending/confirmed → cancelled). */
  async cancel(id: string): Promise<ApiResult<TrainingBookingUI>> {
    return this.update(id, { status: 'cancelled' });
  },

  /**
   * Löscht eine Buchung hart aus der DB.
   * Nur für vergangene oder stornierte Buchungen empfohlen;
   * für aktive Buchungen bevorzugt cancel() verwenden.
   */
  async remove(id: string): Promise<ApiResult<void>> {
    return tryCatch(async () => {
      const { error } = await supabase
        .from('training_bookings')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }, fromSupabaseError);
  },
};

// ─── Legacy-Typen (Rückwärtskompatibilität) ───────────────────────────────────
// Verwende stattdessen TrainingBookingUI aus '@/types/domain/training'.

/** @deprecated Nutze TrainingBookingUI aus '@/types/domain/training'. */
export type TrainingBookingRow = Tables<'training_bookings'>;
