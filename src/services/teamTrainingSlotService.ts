/**
 * teamTrainingSlotService
 *
 * Trennt Team-Stammdaten (wöchentliche Trainingszeiten) von individuellen Buchungen.
 *
 * ─── Zwei Konzepte ───────────────────────────────────────────────────────────
 *
 * 1. TeamTrainingSlot (Stammdaten)
 *    Wöchentlich wiederkehrende Trainingszeiten einer Mannschaft.
 *    Tabelle: team_training_slots  ← BENÖTIGT DB-MIGRATION (Typ-DDL in training.ts)
 *
 * 2. Buchungsbasierte Team-Trainingszeiten (Read-Path – heute verfügbar)
 *    Filtert training_bookings, bei denen beide Teilnehmer im Kader sind.
 *    Geeignet für Profil- und Teamansichten solange kein separates Slot-Table existiert.
 *
 * ─── Nutzung ──────────────────────────────────────────────────────────────────
 *
 * Team-Ansicht:
 *   const bookings = await teamTrainingSlotService.getBookingsForTeam(teamId);
 *   const pattern  = await teamTrainingSlotService.getWeeklyPattern(teamId);
 *
 * Profil-Ansicht:
 *   const next = await teamTrainingSlotService.getUpcomingForMember(memberId);
 *
 * Slot-Verwaltung (nach DB-Migration):
 *   const slots = await teamTrainingSlotService.listSlots(teamId);
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { errors, fromSupabaseError } from '@/lib/error';
import { todayISO } from '@/lib/date';
import type { ApiResult } from '@/types/api';
import type {
  TeamTrainingSlot,
  TeamTrainingSlotUI,
  TrainingBookingUI,
  WeeklyPatternEntry,
  Weekday,
} from '@/types/domain/training';
import { WEEKDAY_LABELS } from '@/types/domain/training';
import {
  teamTrainingSlotCreateSchema,
  teamTrainingSlotUpdateSchema,
  teamTrainingSlotFilterSchema,
  type TeamTrainingSlotCreateInput,
  type TeamTrainingSlotUpdateInput,
  type TeamTrainingSlotFilterInput,
} from '@/schemas/training.schema';

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

/** Konvertiert booking_date (YYYY-MM-DD) in ISO-Wochentag 1–7. */
function toISOWeekday(isoDate: string): Weekday {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sonntag
  return (day === 0 ? 7 : day) as Weekday;
}

/** Slot-Mapping für toUI (Laufzeit-DB-Row → Domain-Type). */
function slotToUI(row: any): TeamTrainingSlotUI {
  const today = todayISO();
  const withinFrom = !row.valid_from || row.valid_from <= today;
  const withinTo   = !row.valid_to   || row.valid_to   >= today;
  return {
    id:         row.id,
    team_id:    row.team_id,
    weekday:    row.weekday as Weekday,
    weekday_label: WEEKDAY_LABELS[row.weekday as Weekday],
    start_time: row.start_time,
    end_time:   row.end_time,
    location:   row.location,
    is_active:  row.is_active,
    valid_from: row.valid_from,
    valid_to:   row.valid_to,
    created_at: row.created_at,
    updated_at: row.updated_at,
    isCurrentlyActive: row.is_active && withinFrom && withinTo,
  } as TeamTrainingSlotUI;
}

const BOOKING_SELECT = `
  *,
  requester:members!training_bookings_requester_id_fkey(first_name, last_name),
  partner:members!training_bookings_partner_id_fkey(first_name, last_name)
`.trim();

function bookingToUI(row: any, today: string): TrainingBookingUI {
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
    requester: row.requester ?? null,
    partner:   row.partner   ?? null,
    isPast:    row.booking_date < today,
    isToday:   row.booking_date === today,
  } as TrainingBookingUI;
}

// ─── Service ───────────────────────────────────────────────────────────────────

export const teamTrainingSlotService = {

  // ── Buchungsbasierter Read-Path (keine Migration nötig) ───────────────────────

  /**
   * Alle Trainingsbuchungen für eine Mannschaft.
   *
   * Strategie: Beide Teilnehmer einer Buchung müssen im Kader sein.
   * Diese Methode ersetzt teamAssignmentService.getTeamTrainingTimes() und ist
   * der primäre Einstiegspunkt für die Team-Trainingsansicht.
   *
   * @param teamId  UUID der Mannschaft
   * @param filter  Optional: from_date, to_date, upcoming_only, status
   */
  async getBookingsForTeam(
    teamId: string,
    filter: {
      from_date?:     string;
      to_date?:       string;
      upcoming_only?: boolean;
      status?:        'pending' | 'confirmed' | 'cancelled';
    } = {},
  ): Promise<ApiResult<TrainingBookingUI[]>> {
    return tryCatch(async () => {
      // 1. Kader-IDs laden
      const { data: rosterRows, error: rosterErr } = await supabase
        .from('team_members')
        .select('member_id')
        .eq('team_id', teamId);
      if (rosterErr) throw fromSupabaseError(rosterErr);

      const memberIds = [...new Set((rosterRows ?? []).map((r: any) => r.member_id))];
      // Leerer Kader → keine Buchungen
      if (memberIds.length === 0) return [];

      // 2. Buchungen laden (BEIDE Teilnehmer im Kader)
      let q = supabase
        .from('training_bookings')
        .select(BOOKING_SELECT)
        .in('requester_id', memberIds)
        .in('partner_id', memberIds)
        .order('booking_date', { ascending: true })
        .order('start_time',   { ascending: true });

      const today = todayISO();
      if (filter.upcoming_only) q = q.gte('booking_date', today);
      if (filter.from_date)     q = q.gte('booking_date', filter.from_date);
      if (filter.to_date)       q = q.lte('booking_date', filter.to_date);
      if (filter.status)        q = q.eq('status', filter.status);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r: any) => bookingToUI(r, today));
    }, fromSupabaseError);
  },

  /** Anstehende Buchungen einer Mannschaft (nächste N). */
  async getUpcomingForTeam(teamId: string, limit = 5): Promise<ApiResult<TrainingBookingUI[]>> {
    const result = await this.getBookingsForTeam(teamId, { upcoming_only: true });
    if (!result.success) return result;
    return ok(result.data.slice(0, limit));
  },

  /**
   * Aggregiert Buchungen nach Wochentag – zeigt Trainingsgewohnheiten der Mannschaft.
   * Analysefenster: letzten 90 Tage + nächste 30 Tage (aktive Saison).
   *
   * Verwendung: Teamansicht-Sidebar "Wann trainiert diese Mannschaft?"
   */
  async getWeeklyPattern(teamId: string): Promise<ApiResult<WeeklyPatternEntry[]>> {
    return tryCatch(async () => {
      const today = todayISO();
      const from  = new Date(today);
      from.setDate(from.getDate() - 90);
      const fromISO = from.toISOString().slice(0, 10);

      const bookingsResult = await this.getBookingsForTeam(teamId, {
        from_date: fromISO,
        status:    'confirmed',
      });
      if (!bookingsResult.success) throw new Error(bookingsResult.error.message);

      // Wochentag → Zeitfenster-Map
      type SlotKey = string; // `${start_time}|${end_time}|${location}`
      const weekdayMap = new Map<
        Weekday,
        Map<SlotKey, { start_time: string; end_time: string | null; location: string | null; count: number }>
      >();

      for (const booking of bookingsResult.data) {
        const weekday = toISOWeekday(booking.booking_date);
        if (!weekdayMap.has(weekday)) weekdayMap.set(weekday, new Map());

        const slotKey: SlotKey =
          `${booking.start_time}|${booking.end_time ?? ''}|${booking.location ?? ''}`;
        const slotMap = weekdayMap.get(weekday)!;

        if (slotMap.has(slotKey)) {
          slotMap.get(slotKey)!.count++;
        } else {
          slotMap.set(slotKey, {
            start_time: booking.start_time,
            end_time:   booking.end_time,
            location:   booking.location,
            count:      1,
          });
        }
      }

      // In sortiertes Array umwandeln (Mo → So)
      const result: WeeklyPatternEntry[] = [];
      for (const weekday of [1, 2, 3, 4, 5, 6, 7] as Weekday[]) {
        const slotMap = weekdayMap.get(weekday);
        if (!slotMap) continue;

        const totalCount = [...slotMap.values()].reduce((s, v) => s + v.count, 0);
        const typical_slots = [...slotMap.values()]
          .sort((a, b) => b.count - a.count)
          .slice(0, 3); // max. 3 typische Zeitfenster

        result.push({
          weekday,
          weekday_label: WEEKDAY_LABELS[weekday],
          booking_count: totalCount,
          typical_slots,
        });
      }

      return result;
    }, fromSupabaseError);
  },

  /**
   * Alle aktiven Team-Buchungen für ein Mitglied (Profilansicht).
   * Zeigt "Wann trainiert dieses Mitglied mit welchem Team?"
   */
  async getUpcomingForMember(memberId: string, limit = 10): Promise<ApiResult<TrainingBookingUI[]>> {
    return tryCatch(async () => {
      const today = todayISO();
      const { data, error } = await supabase
        .from('training_bookings')
        .select(BOOKING_SELECT)
        .or(`requester_id.eq.${memberId},partner_id.eq.${memberId}`)
        .gte('booking_date', today)
        .in('status', ['pending', 'confirmed'])
        .order('booking_date', { ascending: true })
        .order('start_time',   { ascending: true })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r: any) => bookingToUI(r, today));
    }, fromSupabaseError);
  },

  // ── Slot-CRUD (benötigt DB-Migration: team_training_slots) ────────────────────
  // Alle Methoden ab hier geben einen NOT_FOUND-ähnlichen Fehler zurück,
  // bis die Migration ausgeführt wurde. Danach einfach den err()-Block entfernen.

  /**
   * Listet alle Trainingsslots einer Mannschaft.
   *
   * ⚠️ Benötigt DB-Migration: CREATE TABLE team_training_slots (...)
   * DDL-Vorlage → src/types/domain/training.ts
   */
  async listSlots(filter: TeamTrainingSlotFilterInput = {}): Promise<ApiResult<TeamTrainingSlotUI[]>> {
    const parsed = teamTrainingSlotFilterSchema.safeParse(filter);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.issues));
    }

    return tryCatch(async () => {
      let q = supabase
        .from('team_training_slots' as any)
        .select('*')
        .order('weekday', { ascending: true })
        .order('start_time', { ascending: true });

      const { team_id, weekday, is_active, on_date } = parsed.data;
      if (team_id)   q = q.eq('team_id', team_id);
      if (weekday)   q = q.eq('weekday', weekday);
      if (is_active != null) q = q.eq('is_active', is_active);

      // Gültigkeitszeitraum: valid_from <= on_date <= valid_to (null = offen)
      if (on_date) {
        q = q.or(`valid_from.is.null,valid_from.lte.${on_date}`);
        q = q.or(`valid_to.is.null,valid_to.gte.${on_date}`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(slotToUI);
    }, fromSupabaseError);
  },

  /** Einzelner Slot. */
  async getSlotById(id: string): Promise<ApiResult<TeamTrainingSlotUI>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('team_training_slots' as any)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw { message: `Trainingsslot "${id}" nicht gefunden`, code: 'PGRST116' };
      return slotToUI(data);
    }, fromSupabaseError);
  },

  /**
   * Erstellt einen neuen wiederkehrenden Trainingsslot für eine Mannschaft.
   *
   * Konflikt-Prüfung: Zwei aktive Slots derselben Mannschaft dürfen am selben
   * Wochentag nicht überlappen (start < other_end && other_start < end).
   */
  async createSlot(
    input: TeamTrainingSlotCreateInput,
  ): Promise<ApiResult<TeamTrainingSlotUI>> {
    const parsed = teamTrainingSlotCreateSchema.safeParse(input);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.issues));
    }

    return tryCatch(async () => {
      // Überschneidungsprüfung für denselben Wochentag
      const { data: existing, error: checkErr } = await supabase
        .from('team_training_slots' as any)
        .select('id, start_time, end_time')
        .eq('team_id', parsed.data.team_id)
        .eq('weekday', parsed.data.weekday)
        .eq('is_active', true);
      if (checkErr) throw checkErr;

      const conflict = (existing ?? []).find((s: any) =>
        parsed.data.start_time < s.end_time &&
        s.start_time < parsed.data.end_time,
      );
      if (conflict) {
        throw errors.conflict(
          `Überschneidung mit bestehendem Slot ${(conflict as any).start_time}–${(conflict as any).end_time} ` +
          `am selben Wochentag (ID: ${(conflict as any).id})`,
        );
      }

      const { data, error } = await supabase
        .from('team_training_slots' as any)
        .insert(parsed.data)
        .select('*')
        .single();
      if (error) throw error;
      return slotToUI(data);
    }, fromSupabaseError);
  },

  /** Slot aktualisieren (Zeiten, Ort, Aktiv-Flag, Gültigkeitsdaten). */
  async updateSlot(
    id: string,
    input: TeamTrainingSlotUpdateInput,
  ): Promise<ApiResult<TeamTrainingSlotUI>> {
    const parsed = teamTrainingSlotUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return err(errors.validation(parsed.error.message, parsed.error.issues));
    }

    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('team_training_slots' as any)
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return slotToUI(data);
    }, fromSupabaseError);
  },

  /**
   * Deaktiviert einen Slot sanft (is_active = false).
   * Bevorzugt gegenüber hartem Löschen – erhält die Historik.
   */
  async deactivateSlot(id: string): Promise<ApiResult<TeamTrainingSlotUI>> {
    return this.updateSlot(id, { is_active: false, valid_from: null, valid_to: null });
  },

  /** Löscht einen Slot hart. Nur für irrtümlich erstellte Einträge empfohlen. */
  async removeSlot(id: string): Promise<ApiResult<void>> {
    return tryCatch(async () => {
      const { error } = await supabase
        .from('team_training_slots' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    }, fromSupabaseError);
  },
};
