import type { MemberId, TeamId } from '../api';

// ─── Individuelle Trainingsbuchungen ─────────────────────────────────────────
// Tabelle: training_bookings
// Modell: 1:1-Trainingsverabredung zwischen zwei aktiven Vereinsmitgliedern.

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export interface TrainingBooking {
  readonly id: string;
  /** Mitglied, das die Buchung erstellt hat. */
  requester_id: MemberId;
  /** Trainingspartner – muss sich von requester_id unterscheiden. */
  partner_id: MemberId;
  /** ISO YYYY-MM-DD */
  booking_date: string;
  /** HH:MM */
  start_time: string;
  /** HH:MM – null bedeutet offenes Ende. */
  end_time: string | null;
  status: BookingStatus;
  location: string | null;
  note: string | null;
  readonly created_by: string;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Angereicherte Variante mit Joins und abgeleiteten Flags. */
export interface TrainingBookingUI extends TrainingBooking {
  requester: { first_name: string; last_name: string } | null;
  partner: { first_name: string; last_name: string } | null;
  /** Buchungsdatum liegt vor heute (nicht heute selbst). */
  isPast: boolean;
  /** Buchungsdatum ist heute. */
  isToday: boolean;
}

// ─── Team-Trainingsslots (Stammdaten) ─────────────────────────────────────────
// Tabelle: team_training_slots  ← BENÖTIGT DB-MIGRATION
//
//   CREATE TABLE team_training_slots (
//     id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     team_id       uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
//     weekday       smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
//     start_time    time NOT NULL,
//     end_time      time NOT NULL,
//     location      text,
//     is_active     boolean NOT NULL DEFAULT true,
//     valid_from    date,
//     valid_to      date,
//     created_at    timestamptz NOT NULL DEFAULT now(),
//     updated_at    timestamptz NOT NULL DEFAULT now(),
//     CONSTRAINT chk_slot_times CHECK (end_time > start_time),
//     CONSTRAINT chk_slot_dates CHECK (valid_to IS NULL OR valid_to >= valid_from)
//   );
//   CREATE INDEX ON team_training_slots (team_id, weekday);
//   CREATE INDEX ON team_training_slots (team_id, is_active);

/** ISO-Wochentag: 1 = Montag, 7 = Sonntag (ISO 8601). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
  7: 'Sonntag',
};

export interface TeamTrainingSlot {
  readonly id: string;
  team_id: TeamId;
  /** ISO-Wochentag 1–7 */
  weekday: Weekday;
  /** HH:MM */
  start_time: string;
  /** HH:MM */
  end_time: string;
  location: string | null;
  is_active: boolean;
  /** Ab diesem Datum gilt der Slot. null = gilt von Anfang an. */
  valid_from: string | null;
  /** Bis zu diesem Datum gilt der Slot. null = kein Ende. */
  valid_to: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface TeamTrainingSlotUI extends TeamTrainingSlot {
  weekday_label: string;
  /** Slot ist zum heutigen Datum aktiv und innerhalb des Gültigkeitszeitraums. */
  isCurrentlyActive: boolean;
}

// ─── Wochenmuster-Aggregat ─────────────────────────────────────────────────────
// Ergebnis von teamTrainingSlotService.getWeeklyPattern():
// Aggregiert Buchungen nach Wochentag → zeigt Trainingsgewohnheiten.

export interface WeeklyPatternEntry {
  weekday: Weekday;
  weekday_label: string;
  /** Anzahl der Buchungen an diesem Wochentag (letzten 90 Tage). */
  booking_count: number;
  /** Häufigste Zeitfenster an diesem Wochentag. */
  typical_slots: Array<{
    start_time: string;
    end_time: string | null;
    location: string | null;
    count: number;
  }>;
}

export type TrainingBookingCreate = Omit<TrainingBooking, 'id' | 'status' | 'created_at' | 'updated_at'>;
export type TeamTrainingSlotCreate = Omit<TeamTrainingSlot, 'id' | 'created_at' | 'updated_at'>;
export type TeamTrainingSlotUpdate = Partial<Omit<TeamTrainingSlotCreate, 'team_id'>>;
