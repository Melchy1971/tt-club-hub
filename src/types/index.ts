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

export type MatchAvailability = Tables<'match_availability'>;
export type MatchAvailabilityInsert = TablesInsert<'match_availability'>;
export type MatchLineup = Tables<'match_lineup'>;
export type MatchLineupInsert = TablesInsert<'match_lineup'>;

export type Role = Tables<'roles'>;
export type UserRole = Tables<'user_roles'>;
export type ClubSettings = Tables<'club_settings'>;

// === Training ===
export type TrainingBooking = Tables<'training_bookings'>;
export type TrainingBookingInsert = TablesInsert<'training_bookings'>;
export type TrainingBookingUpdate = TablesUpdate<'training_bookings'>;

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

// === News ===
export type { NewsRow, NewsCreateDTO, NewsUpdateDTO, NewsFilter } from './domain/news';

// === Enum Types ===
export type AppRole = Enums<'app_role'>;
export type AgeGroup = Enums<'age_group'>;
export type MatchStatus = Enums<'match_status'>;
export type Gender = Enums<'gender'>;

export * from './member';

// === Dashboard ===
export interface DashboardStats {
  totalMembers: number;
  activeTeams: number;
  upcomingMatches: number;
  seasonWinRate: number;
}
