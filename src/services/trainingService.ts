/**
 * trainingService
 *
 * Verwaltet training_sessions und training_bookings.
 *
 * Konsistenz-Schichten:
 *   1. Schema (Zod)       – Typen, Format, Eigenbeziehungen (requester ≠ partner)
 *   2. Service            – Konflikt-Checks vor DB-Call (bessere Fehlermeldungen)
 *   3. DB-Trigger         – letzte Sicherungslinie (redundant, aber robust)
 *
 * Buchungs-Status-Übergänge:
 *   pending    → confirmed, waitlisted, cancelled
 *   confirmed  → cancelled
 *   waitlisted → confirmed, cancelled
 *   cancelled  → (terminal)
 *
 * Wartelisten-Promotion:
 *   Wenn eine bestätigte Buchung storniert wird und die Session eine
 *   max_participants-Grenze hat, wird automatisch die älteste Wartelisten-
 *   Buchung auf 'confirmed' gesetzt (FIFO).
 *   → promoteWaitlist() wird nach jedem cancel() intern aufgerufen.
 *
 * Edge Cases:
 *   – requester_id == partner_id                → Schema + DB-CHECK
 *   – Partner bereits als requester gebucht     → service + DB-Trigger
 *   – Partner bereits als partner gebucht       → service + DB-Trigger
 *   – requester bereits als partner einer anderen Buchung → service + DB-Trigger
 *   – Session storniert                         → service + DB-Trigger
 *   – Session in der Vergangenheit              → Schema + DB-Trigger
 *   – Kapazität voll bei pending/confirmed      → Auto-Waitlist (DB-Trigger)
 *   – Stornierung vergangener Session           → DB-Trigger NOTICE
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { errors, fromSupabaseError, getErrorMessage } from '@/lib/error';
import { hasPermission } from '@/lib/permissions';
import type { ApiResult, AppError } from '@/types/api';
import type { AppRole } from '@/types/auth';
import {
  trainingSessionCreateSchema,
  trainingSessionUpdateSchema,
  trainingSessionFilterSchema,
  trainingBookingCreateSchema,
  trainingBookingUpdateSchema,
  trainingBookingFilterSchema,
  isValidBookingTransition,
  TERMINAL_BOOKING_STATUSES,
  type TrainingSessionCreateInput,
  type TrainingSessionUpdateInput,
  type TrainingSessionFilterInput,
  type TrainingBookingCreateInput,
  type TrainingBookingFilterInput,
  type BookingStatus,
} from '@/schemas/training.schema';

// ─── DB-Typen ─────────────────────────────────────────────────────────────────

interface TrainingSessionRow {
  id: string;
  team_id: string | null;
  venue_id: string | null;
  title: string | null;
  description: string | null;
  start_ts: string;
  end_ts: string;
  max_participants: number | null;
  is_cancelled: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface TrainingBookingRow {
  id: string;
  session_id: string;
  requester_id: string;
  partner_id: string | null;
  status: BookingStatus;
  booked_by: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  note: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

// ─── UI-Typen ─────────────────────────────────────────────────────────────────

export interface TrainingSessionUI {
  id: string;
  teamId: string | null;
  venueId: string | null;
  title: string | null;
  description: string | null;
  startTs: string;
  endTs: string;
  maxParticipants: number | null;
  isCancelled: boolean;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  // Derived
  isPast: boolean;
  isOngoing: boolean;
  /** Anzahl aktiver Buchungen (pending + confirmed + waitlisted) */
  activeBookingsCount?: number;
  /** Freie Plätze (null = unbegrenzt) */
  spotsAvailable?: number | null;
  // Joined
  venueName?: string;
  teamName?: string;
}

export interface TrainingBookingUI {
  id: string;
  sessionId: string;
  requesterId: string;
  partnerId: string | null;
  status: BookingStatus;
  bookedBy: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  note: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined
  requesterFirstName?: string;
  requesterLastName?: string;
  requesterFullName?: string;
  partnerFirstName?: string;
  partnerLastName?: string;
  partnerFullName?: string;
  sessionStartTs?: string;
  sessionEndTs?: string;
  sessionTitle?: string;
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

function sessionToUI(
  row: TrainingSessionRow & {
    venues?: { name: string } | null;
    teams?: { name: string } | null;
    _bookingsCount?: number;
  },
): TrainingSessionUI {
  const now = new Date();
  const start = new Date(row.start_ts);
  const end = new Date(row.end_ts);

  const activeCount = row._bookingsCount ?? undefined;
  const spotsAvailable =
    row.max_participants != null && activeCount != null
      ? Math.max(0, row.max_participants - activeCount)
      : row.max_participants != null
        ? null // unbekannt
        : null; // unbegrenzt → null

  return {
    id:              row.id,
    teamId:          row.team_id,
    venueId:         row.venue_id,
    title:           row.title,
    description:     row.description,
    startTs:         row.start_ts,
    endTs:           row.end_ts,
    maxParticipants: row.max_participants,
    isCancelled:     row.is_cancelled,
    notes:           row.notes,
    createdBy:       row.created_by,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
    isPast:          end < now,
    isOngoing:       start <= now && now <= end,
    activeBookingsCount: activeCount,
    spotsAvailable,
    venueName:       row.venues?.name,
    teamName:        row.teams?.name,
  };
}

type BookingJoinedRow = TrainingBookingRow & {
  requester?: { first_name: string; last_name: string } | null;
  partner?:   { first_name: string; last_name: string } | null;
  session?:   { start_ts: string; end_ts: string; title: string | null } | null;
};

function bookingToUI(row: BookingJoinedRow): TrainingBookingUI {
  return {
    id:           row.id,
    sessionId:    row.session_id,
    requesterId:  row.requester_id,
    partnerId:    row.partner_id,
    status:       row.status,
    bookedBy:     row.booked_by,
    cancelledBy:  row.cancelled_by,
    cancelledAt:  row.cancelled_at,
    note:         row.note,
    cancelReason: row.cancel_reason,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
    requesterFirstName: row.requester?.first_name,
    requesterLastName:  row.requester?.last_name,
    requesterFullName:  row.requester
      ? `${row.requester.first_name} ${row.requester.last_name}`.trim()
      : undefined,
    partnerFirstName: row.partner?.first_name,
    partnerLastName:  row.partner?.last_name,
    partnerFullName:  row.partner
      ? `${row.partner.first_name} ${row.partner.last_name}`.trim()
      : undefined,
    sessionStartTs: row.session?.start_ts,
    sessionEndTs:   row.session?.end_ts,
    sessionTitle:   row.session?.title ?? undefined,
  };
}

const toAppError = (e: unknown): AppError => {
  if (e != null && typeof e === 'object' && 'code' in e && 'message' in e) {
    return e as AppError;
  }
  return errors.internal(getErrorMessage(e));
};

// ─── Interne Konflikt-Prüfung ─────────────────────────────────────────────────

async function checkBookingConflicts(
  input: TrainingBookingCreateInput,
): Promise<AppError | null> {
  // 1. Session laden
  const { data: session } = await supabase
    .from('training_sessions')
    .select('id, start_ts, end_ts, is_cancelled, max_participants')
    .eq('id', input.session_id)
    .maybeSingle();

  if (!session) return errors.notFound('Training-Session', input.session_id);
  if (session.is_cancelled)
    return errors.validation('Training-Session ist storniert — keine Buchungen möglich');
  if (new Date(session.end_ts) < new Date())
    return errors.validation('Training-Session hat bereits stattgefunden');

  // 2. Requester bereits gebucht? (uq_booking_session_requester verhindert DB-seitig)
  const { data: existingReq } = await supabase
    .from('training_bookings')
    .select('id, status')
    .eq('session_id', input.session_id)
    .eq('requester_id', input.requester_id)
    .neq('status', 'cancelled')
    .maybeSingle();

  if (existingReq)
    return errors.conflict(`Mitglied ist bereits mit Status "${existingReq.status}" für diese Session gebucht`);

  // 3. Requester taucht als partner_id einer anderen Buchung auf?
  const { data: asPartner } = await supabase
    .from('training_bookings')
    .select('id')
    .eq('session_id', input.session_id)
    .eq('partner_id', input.requester_id)
    .neq('status', 'cancelled')
    .maybeSingle();

  if (asPartner)
    return errors.conflict('Mitglied ist bereits als Partner einer anderen Buchung für diese Session eingetragen');

  if (input.partner_id) {
    // 4. Partner als requester gebucht?
    const { data: partnerAsReq } = await supabase
      .from('training_bookings')
      .select('id')
      .eq('session_id', input.session_id)
      .eq('requester_id', input.partner_id)
      .neq('status', 'cancelled')
      .maybeSingle();

    if (partnerAsReq)
      return errors.conflict('Der Partner ist für diese Session bereits als eigenständiger Teilnehmer gebucht');

    // 5. Partner bereits als partner_id einer anderen Buchung?
    const { data: partnerAsPartner } = await supabase
      .from('training_bookings')
      .select('id')
      .eq('session_id', input.session_id)
      .eq('partner_id', input.partner_id)
      .neq('status', 'cancelled')
      .maybeSingle();

    if (partnerAsPartner)
      return errors.conflict('Der Partner ist für diese Session bereits als Partner einer anderen Buchung eingetragen');
  }

  return null;
}

// ─── Wartelisten-Promotion (FIFO) ─────────────────────────────────────────────

/**
 * Rückt den ältesten Wartelisten-Eintrag nach, wenn ein Platz frei wird.
 * Intern nach cancel() aufgerufen.
 * Gibt die ID der beförderten Buchung zurück oder null.
 */
async function promoteWaitlist(sessionId: string): Promise<string | null> {
  // Prüfen ob Session eine Kapazitätsgrenze hat
  const { data: session } = await supabase
    .from('training_sessions')
    .select('max_participants')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session?.max_participants) return null; // unbegrenzt → keine Warteliste

  // Aktuelle Belegung
  const { count: activeCount } = await supabase
    .from('training_bookings')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .in('status', ['pending', 'confirmed']);

  if ((activeCount ?? 0) >= session.max_participants) return null; // immer noch voll

  // Ältesten Wartelisten-Eintrag laden (FIFO: created_at ASC)
  const { data: waitlisted } = await supabase
    .from('training_bookings')
    .select('id')
    .eq('session_id', sessionId)
    .eq('status', 'waitlisted')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!waitlisted) return null;

  await supabase
    .from('training_bookings')
    .update({ status: 'confirmed' })
    .eq('id', waitlisted.id);

  return waitlisted.id;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const trainingService = {
  // ══ Sessions ════════════════════════════════════════════════════════════════

  async listSessions(filter: TrainingSessionFilterInput = {}): Promise<ApiResult<TrainingSessionUI[]>> {
    const parsed = trainingSessionFilterSchema.safeParse(filter);
    if (!parsed.success) return err(errors.validation(parsed.error.message));

    return tryCatch(async () => {
      const { team_id, venue_id, from_ts, to_ts, is_cancelled, upcoming_only } = parsed.data;
      const now = new Date().toISOString();

      let q = supabase
        .from('training_sessions')
        .select('*, venues(name), teams(name)');

      if (team_id)      q = q.eq('team_id', team_id);
      if (venue_id)     q = q.eq('venue_id', venue_id);
      if (from_ts)      q = q.gte('start_ts', from_ts);
      if (to_ts)        q = q.lte('start_ts', to_ts);
      if (is_cancelled != null) q = q.eq('is_cancelled', is_cancelled);
      if (upcoming_only) q = q.gte('start_ts', now).eq('is_cancelled', false);

      const { data, error } = await q.order('start_ts', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => sessionToUI(r as TrainingSessionRow & { venues: { name: string } | null; teams: { name: string } | null }));
    }, toAppError);
  },

  async getSession(id: string): Promise<ApiResult<TrainingSessionUI>> {
    return tryCatch(async () => {
      const [sessionResult, countResult] = await Promise.all([
        supabase
          .from('training_sessions')
          .select('*, venues(name), teams(name)')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('training_bookings')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', id)
          .in('status', ['pending', 'confirmed', 'waitlisted']),
      ]);

      if (sessionResult.error) throw sessionResult.error;
      if (!sessionResult.data) throw { message: `Session "${id}" nicht gefunden`, code: 'PGRST116' };

      return sessionToUI({
        ...(sessionResult.data as TrainingSessionRow & { venues: { name: string } | null; teams: { name: string } | null }),
        _bookingsCount: countResult.count ?? 0,
      });
    }, toAppError);
  },

  /**
   * Berechtigung: training:write
   */
  async createSession(
    input: TrainingSessionCreateInput,
    actorRole: AppRole,
    actorUserId: string,
  ): Promise<ApiResult<TrainingSessionUI>> {
    if (!hasPermission(actorRole, 'training:write')) {
      return err(errors.forbidden('Training-Session erstellen'));
    }
    const parsed = trainingSessionCreateSchema.safeParse(input);
    if (!parsed.success) return err(errors.validation(parsed.error.message, parsed.error.issues));

    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('training_sessions')
        .insert({ ...parsed.data, created_by: actorUserId })
        .select('*, venues(name), teams(name)')
        .single();
      if (error) throw error;
      return sessionToUI(data as TrainingSessionRow & { venues: { name: string } | null; teams: { name: string } | null });
    }, toAppError);
  },

  /**
   * Berechtigung: training:write + Eigentumscheck (created_by) ODER trainer+
   */
  async updateSession(
    id: string,
    input: TrainingSessionUpdateInput,
    actorRole: AppRole,
    actorUserId: string,
  ): Promise<ApiResult<TrainingSessionUI>> {
    if (!hasPermission(actorRole, 'training:write')) {
      return err(errors.forbidden('Training-Session bearbeiten'));
    }
    const parsed = trainingSessionUpdateSchema.safeParse(input);
    if (!parsed.success) return err(errors.validation(parsed.error.message, parsed.error.issues));
    if (Object.keys(parsed.data).length === 0)
      return err(errors.validation('Keine Felder zum Aktualisieren angegeben'));

    // Eigentumscheck für spieler-Rolle
    if (actorRole === 'spieler') {
      const { data: session } = await supabase
        .from('training_sessions')
        .select('created_by')
        .eq('id', id)
        .maybeSingle();
      if (session?.created_by !== actorUserId) {
        return err(errors.forbidden('Nur der Ersteller darf diese Session bearbeiten'));
      }
    }

    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('training_sessions')
        .update(parsed.data)
        .eq('id', id)
        .select('*, venues(name), teams(name)')
        .single();
      if (error) throw error;
      return sessionToUI(data as TrainingSessionRow & { venues: { name: string } | null; teams: { name: string } | null });
    }, toAppError);
  },

  /**
   * Session stornieren (soft-delete via is_cancelled).
   * Storniert automatisch alle offenen Buchungen.
   *
   * Berechtigung: training:write
   */
  async cancelSession(
    id: string,
    actorRole: AppRole,
    actorUserId: string,
    reason?: string,
  ): Promise<ApiResult<{ sessionId: string; cancelledBookings: number }>> {
    if (!hasPermission(actorRole, 'training:write')) {
      return err(errors.forbidden('Training-Session stornieren'));
    }

    return tryCatch(async () => {
      // Session als storniert markieren
      const { error: sessionError } = await supabase
        .from('training_sessions')
        .update({ is_cancelled: true })
        .eq('id', id);
      if (sessionError) throw sessionError;

      // Alle nicht-stornierten Buchungen stornieren
      const { data, error: bookingError } = await supabase
        .from('training_bookings')
        .update({
          status:       'cancelled',
          cancel_reason: reason ?? 'Session storniert',
          cancelled_by:  actorUserId,
        })
        .eq('session_id', id)
        .neq('status', 'cancelled')
        .select('id');
      if (bookingError) throw bookingError;

      return { sessionId: id, cancelledBookings: (data ?? []).length };
    }, toAppError);
  },

  // ══ Bookings ════════════════════════════════════════════════════════════════

  async listBookings(filter: TrainingBookingFilterInput = {}): Promise<ApiResult<TrainingBookingUI[]>> {
    const parsed = trainingBookingFilterSchema.safeParse(filter);
    if (!parsed.success) return err(errors.validation(parsed.error.message));

    return tryCatch(async () => {
      const { session_id, requester_id, partner_id, status, member_id } = parsed.data;

      let q = supabase
        .from('training_bookings')
        .select(`
          *,
          requester:members!requester_id(first_name, last_name),
          partner:members!partner_id(first_name, last_name),
          session:training_sessions!session_id(start_ts, end_ts, title)
        `);

      if (session_id)   q = q.eq('session_id', session_id);
      if (requester_id) q = q.eq('requester_id', requester_id);
      if (partner_id)   q = q.eq('partner_id', partner_id);
      if (status)       q = q.eq('status', status);

      // member_id-Filter: requester ODER partner
      if (member_id) {
        q = q.or(`requester_id.eq.${member_id},partner_id.eq.${member_id}`);
      }

      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => bookingToUI(r as BookingJoinedRow));
    }, toAppError);
  },

  async getBooking(id: string): Promise<ApiResult<TrainingBookingUI>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('training_bookings')
        .select(`
          *,
          requester:members!requester_id(first_name, last_name),
          partner:members!partner_id(first_name, last_name),
          session:training_sessions!session_id(start_ts, end_ts, title)
        `)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw { message: `Buchung "${id}" nicht gefunden`, code: 'PGRST116' };
      return bookingToUI(data as BookingJoinedRow);
    }, toAppError);
  },

  /**
   * Neue Buchung anlegen.
   *
   * Berechtigung: training:write
   * Kapazität voll → DB-Trigger setzt status automatisch auf 'waitlisted'.
   */
  async book(
    input: TrainingBookingCreateInput,
    actorRole: AppRole,
    actorUserId: string,
  ): Promise<ApiResult<TrainingBookingUI>> {
    if (!hasPermission(actorRole, 'training:write')) {
      return err(errors.forbidden('Training buchen'));
    }
    const parsed = trainingBookingCreateSchema.safeParse(input);
    if (!parsed.success) return err(errors.validation(parsed.error.message, parsed.error.issues));

    const conflict = await checkBookingConflicts(parsed.data);
    if (conflict) return err(conflict);

    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('training_bookings')
        .insert({ ...parsed.data, booked_by: actorUserId })
        .select(`
          *,
          requester:members!requester_id(first_name, last_name),
          partner:members!partner_id(first_name, last_name),
          session:training_sessions!session_id(start_ts, end_ts, title)
        `)
        .single();
      if (error) throw error;
      return bookingToUI(data as BookingJoinedRow);
    }, (e) => {
      const msg = getErrorMessage(e);
      // DB-Trigger-Fehlermeldungen leserfreundlich mappen
      if (msg.includes('storniert') || msg.includes('stattgefunden'))
        return errors.validation(msg);
      if (msg.includes('bereits') || msg.includes('Partner'))
        return errors.conflict(msg);
      return fromSupabaseError(e as { message: string; code?: string });
    });
  },

  /**
   * Buchungs-Status ändern (confirm / waitlist / cancel).
   *
   * Berechtigung:
   *   cancel: booked_by == actorUserId ODER training:write
   *   confirm/waitlist: training:write (trainer+)
   *
   * Nach einer Stornierung wird promoteWaitlist() aufgerufen.
   */
  async updateBookingStatus(
    id: string,
    newStatus: BookingStatus,
    actorRole: AppRole,
    actorUserId: string,
    cancelReason?: string,
  ): Promise<ApiResult<TrainingBookingUI>> {
    // Aktuelle Buchung laden
    const current = await trainingService.getBooking(id);
    if (!current.success) return current;

    const booking = current.data;

    if (TERMINAL_BOOKING_STATUSES.has(booking.status)) {
      return err(errors.validation(`Buchung ist bereits "${booking.status}" und kann nicht mehr geändert werden`));
    }

    if (!isValidBookingTransition(booking.status, newStatus)) {
      return err(errors.validation(`Übergang von "${booking.status}" nach "${newStatus}" ist nicht erlaubt`));
    }

    // Berechtigungs-Check
    if (newStatus === 'cancelled') {
      const isOwner = booking.bookedBy === actorUserId;
      if (!isOwner && !hasPermission(actorRole, 'training:write')) {
        return err(errors.forbidden('Nur der Bucher oder ein Trainer darf stornieren'));
      }
    } else {
      if (!hasPermission(actorRole, 'training:write')) {
        return err(errors.forbidden('Status-Änderung erfordert Trainer-Berechtigung'));
      }
    }

    const result = await tryCatch(async () => {
      const patch: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'cancelled') {
        patch.cancel_reason = cancelReason ?? null;
        patch.cancelled_by  = actorUserId;
      }

      const { data, error } = await supabase
        .from('training_bookings')
        .update(patch)
        .eq('id', id)
        .select(`
          *,
          requester:members!requester_id(first_name, last_name),
          partner:members!partner_id(first_name, last_name),
          session:training_sessions!session_id(start_ts, end_ts, title)
        `)
        .single();
      if (error) throw error;
      return bookingToUI(data as BookingJoinedRow);
    }, toAppError);

    // Warteliste nach Stornierung aufwerten
    if (result.success && newStatus === 'cancelled') {
      await promoteWaitlist(booking.sessionId);
    }

    return result;
  },

  // ── Convenience-Methoden ──────────────────────────────────────────────────────

  async confirmBooking(id: string, actorRole: AppRole, actorUserId: string): Promise<ApiResult<TrainingBookingUI>> {
    return trainingService.updateBookingStatus(id, 'confirmed', actorRole, actorUserId);
  },

  async cancelBooking(
    id: string,
    actorRole: AppRole,
    actorUserId: string,
    reason?: string,
  ): Promise<ApiResult<TrainingBookingUI>> {
    return trainingService.updateBookingStatus(id, 'cancelled', actorRole, actorUserId, reason);
  },

  /**
   * Wartelisten-Position eines Mitglieds für eine Session ermitteln.
   * Gibt null zurück wenn nicht auf der Warteliste.
   */
  async getWaitlistPosition(sessionId: string, memberId: string): Promise<ApiResult<number | null>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('training_bookings')
        .select('id, requester_id, created_at')
        .eq('session_id', sessionId)
        .eq('status', 'waitlisted')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const pos = (data ?? []).findIndex((r) => r.requester_id === memberId);
      return pos === -1 ? null : pos + 1;
    }, toAppError);
  },
};
