import type { MemberUI } from '@/types/member';

export type AvailabilityStatus = 'available' | 'maybe' | 'unavailable';

export interface MatchAvailability {
  id: string;
  match_id: string;
  member_id: string;
  status: AvailabilityStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchLineup {
  id: string;
  match_id: string;
  member_id: string;
  position: number;
  is_substitute: boolean;
  created_at: string;
  updated_at: string;
}

export interface RosterEntry {
  member: MemberUI;
  availability?: AvailabilityStatus;
  note?: string | null;
  inLineup?: boolean;
  position?: number;
  isSubstitute?: boolean;
}

export interface MatchRosterView {
  matchId: string;
  roster: RosterEntry[];
}
