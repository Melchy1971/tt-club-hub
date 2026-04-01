import type { MatchId, MemberId, SeasonId, TeamId } from '../api';
import type { Member } from './member';
import type { Team } from './team';

export type MatchStatus = 'geplant' | 'laufend' | 'beendet' | 'verschoben';

export interface Match {
  readonly id: MatchId;
  season_id: SeasonId;
  season_phase_id: string;
  team_id: TeamId;
  match_day: number;
  date: string; // ISO-Datum
  time: string | null; // Format HH:MM
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  venue: string | null;
  is_home: boolean;
  status: MatchStatus;
  readonly created_at: string;
  readonly updated_at: string;
  team?: Team;
}

export interface SingleMatch {
  readonly id: string;
  match_id: MatchId;
  position: number;
  home_player_id: MemberId | null;
  away_player_name: string | null;
  sets_home: number;
  sets_away: number;
  /** JSON-kodierte Satzergebnisse, z.B. "11:9,11:7,9:11,11:8" */
  set_results: string | null;
  home_player?: Member;
}

export type MatchCreate = Omit<Match, 'id' | 'created_at' | 'updated_at' | 'team'>;
export type MatchUpdate = Partial<Omit<MatchCreate, 'season_id' | 'season_phase_id' | 'team_id'>>;
