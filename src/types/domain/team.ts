import type { MemberId, SeasonId, TeamId } from '../api';
import type { Member } from './member';

export interface Team {
  readonly id: TeamId;
  name: string;
  league: string;
  season_id: SeasonId;
  division: string | null;
  captain_id: MemberId | null;
  is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface TeamMember {
  readonly id: string;
  team_id: TeamId;
  member_id: MemberId;
  position: number;
  member?: Member;
}

export type TeamCreate = Omit<Team, 'id' | 'created_at' | 'updated_at'>;
export type TeamUpdate = Partial<TeamCreate>;
