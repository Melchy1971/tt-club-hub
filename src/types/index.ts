// Re-export generated Supabase types for convenience
import type { Tables, TablesInsert, TablesUpdate, Enums } from '@/integrations/supabase/types';

// === Supabase Table Row Types ===
export type Member = Tables<'members'>;
export type MemberInsert = TablesInsert<'members'>;
export type MemberUpdate = TablesUpdate<'members'>;

export type Team = Tables<'teams'>;
export type TeamInsert = TablesInsert<'teams'>;
export type TeamUpdate = TablesUpdate<'teams'>;

export type TeamMember = Tables<'team_members'>;
export type TeamMemberInsert = TablesInsert<'team_members'>;

export type Season = Tables<'seasons'>;
export type SeasonInsert = TablesInsert<'seasons'>;
export type SeasonUpdate = TablesUpdate<'seasons'>;

export type SeasonCycle = Tables<'season_cycles'>;
export type SeasonCycleInsert = TablesInsert<'season_cycles'>;
export type SeasonCycleUpdate = TablesUpdate<'season_cycles'>;

export type SeasonPhase = Tables<'season_phases'>;
export type SeasonPhaseInsert = TablesInsert<'season_phases'>;
export type SeasonPhaseUpdate = TablesUpdate<'season_phases'>;

export type ScheduleMatch = Tables<'schedule_matches'>;
export type ScheduleMatchInsert = TablesInsert<'schedule_matches'>;
export type ScheduleMatchUpdate = TablesUpdate<'schedule_matches'>;

export type Venue = Tables<'venues'>;
export type VenueInsert = TablesInsert<'venues'>;

export interface MatchAvailability {
  id: string;
  match_id: string;
  member_id: string;
  team_id: string;
  status: 'unknown' | 'available' | 'unavailable';
  note: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type MatchAvailabilityInsert = Omit<MatchAvailability, 'id' | 'created_at' | 'updated_at'>;

export interface MatchLineup {
  id: string;
  match_id: string;
  team_id: string;
  member_id: string;
  position: number;
  is_substitute: boolean;
  created_at: string;
  updated_at: string;
}

export type MatchLineupInsert = Omit<MatchLineup, 'id' | 'created_at' | 'updated_at'>;

export type Role = Tables<'roles'>;
export type UserRole = Tables<'member_roles'>;
export type ClubSettings = Tables<'club_settings'>;

// Training types are re-exported from domain/training below

// === News ===
export type { NewsRow, NewsCreateDTO, NewsUpdateDTO, NewsFilter } from './domain/news';

// === Enum Types ===
export type AppRole = Enums<'app_role'>;
export type AgeGroup = Enums<'age_group'>;
export type MatchStatus = Enums<'match_status'>;
export type Gender = Enums<'gender'>;
export type PhaseType = Enums<'phase_type'>;

export * from './member';
export type { SubstituteRequest, SubstituteRequestUI, SubstituteRequestCreate } from './domain/substitute';
export type {
  BookingStatus,
  TrainingBooking,
  TrainingBookingUI,
  TrainingBookingCreate,
  Weekday,
  TeamTrainingSlot,
  TeamTrainingSlotUI,
  TeamTrainingSlotCreate,
  TeamTrainingSlotUpdate,
  WeeklyPatternEntry,
} from './domain/training';

// === Dashboard ===
export interface DashboardStats {
  totalMembers: number;
  activeTeams: number;
  upcomingMatches: number;
  seasonWinRate: number;
}
