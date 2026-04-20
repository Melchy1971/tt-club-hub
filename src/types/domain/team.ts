import type { MemberId, SeasonCycleId, SeasonPhaseId, TeamId } from '../api';
import type { Member } from './member';
import type { AGE_GROUP_VALUES } from '@/schemas/team.schema';

export type AgeGroup = (typeof AGE_GROUP_VALUES)[number];

export interface Team {
  readonly id: TeamId;
  name: string;
  /** Nullable in der DB, aber im UI als Pflichtfeld behandelt. */
  league: string | null;
  /** Operative Referenz – primär für Reads/Writes verwenden. */
  season_phase_id: SeasonPhaseId;
  /** Zyklusreferenz (technische Redundanz für Legacy-Kompatibilität). */
  season_cycle_id: SeasonCycleId;
  /** @deprecated Alias auf season_cycle_id (DB-Spalte teams.season_id). */
  season_id: SeasonCycleId;
  age_group: AgeGroup;
  captain_id: MemberId | null;
  is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface TeamMember {
  readonly id: string;
  team_id: TeamId;
  member_id: MemberId;
  /**
   * Aufstellungsposition (1-20). 0 = keine feste Position.
   * DB-Constraint: position >= 0, UNIQUE(team_id, position).
   */
  position: number;
  readonly created_at: string;
}

/**
 * TeamMember mit gejointen Mitglieds-Daten.
 * Wird von teamAssignmentService.getByTeam() zurückgegeben.
 */
export interface AssignmentWithMember extends TeamMember {
  members: Member;
}

/**
 * Team mit vollständigem Kader.
 * Wird von teamService.getWithRoster() zurückgegeben.
 */
export interface TeamWithRoster extends Team {
  team_members: AssignmentWithMember[];
}

export interface TeamTrainingTime {
  readonly id: string;
  booking_date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  status: 'pending' | 'confirmed' | 'cancelled';
  requester_id: MemberId;
  partner_id: MemberId;
}

export type TeamAssignmentStatus = 'active' | 'historical';

export interface TeamMemberRatingContext {
  /**
   * Optionale Momentaufnahme im Team-Kontext (kann bei Bedarf aus `members` befüllt werden).
   * Null bedeutet: bewusst unbekannt/nicht gepflegt.
   */
  ttr_rating?: number | null;
  qttr_rating?: number | null;
}

/**
 * Persistente Teamzuordnung eines Mitglieds innerhalb einer Saisonphase.
 * Wichtig: Diese Struktur ist eine API-View auf Basis von team_members + teams.
 * Die DB-Tabelle bleibt team_members (positionsbezogene Kaderzuordnung).
 */
export interface MemberTeamAssignment {
  team_id: TeamId;
  member_id: MemberId;
  season_phase_id: SeasonPhaseId;
  season_cycle_id: SeasonCycleId;
  /** @deprecated Alias auf season_cycle_id */
  season_id: SeasonCycleId;
  position: number;
  is_captain: boolean;
  status: TeamAssignmentStatus;
  /**
   * Für aktive Einträge i.d.R. null (offenes Intervall).
   * Historische Einträge sind über `valid_to` abgeschlossen.
   */
  valid_from: string | null;
  valid_to: string | null;
  ratings?: TeamMemberRatingContext;
}

export interface TeamOverview extends Team {
  captain: Pick<Member, 'id' | 'first_name' | 'last_name'> | null;
  roster_size: number;
}

export type TeamCreate = Omit<Team, 'id' | 'created_at' | 'updated_at'>;
export type TeamUpdate = Partial<TeamCreate>;
