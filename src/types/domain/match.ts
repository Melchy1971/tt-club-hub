import type { MatchId, MemberId, SeasonCycleId, SeasonPhaseId, TeamId } from '../api';
import type { Member } from './member';
import type { Team } from './team';

export type MatchStatus = 'geplant' | 'laufend' | 'beendet' | 'verschoben' | 'abgesagt';
export type MatchDataIssue = 'missing_venue' | 'incomplete_score' | 'postponed_match';

export interface Match {
  readonly id: MatchId;
  /** Operative Referenz – primär für Reads/Writes verwenden. */
  season_phase_id: SeasonPhaseId;
  /** Zyklusreferenz (technische Redundanz für Legacy-Kompatibilität). */
  season_cycle_id: SeasonCycleId;
  /** @deprecated Alias auf season_cycle_id (DB-Spalte schedule_matches.season_id). */
  season_id: SeasonCycleId;
  team_id: TeamId;
  match_day: number;
  date: string; // ISO-Datum
  time: string | null; // Format HH:MM
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  venue_id: string | null;
  pin: string | null;
  code: string | null;
  report_text: string | null;
  is_home: boolean;
  status: MatchStatus;
  data_issues?: MatchDataIssue[];
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

export type MatchAvailabilityStatus = 'unknown' | 'available' | 'unavailable' | 'uncertain';

export interface MatchAvailabilityEntry {
  readonly id: string;
  match_id: MatchId;
  member_id: MemberId;
  team_id: TeamId;
  status: MatchAvailabilityStatus;
  note: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface MatchLineupEntry {
  readonly id: string;
  match_id: MatchId;
  member_id: MemberId;
  position: number;
  is_substitute: boolean;
  member?: Member;
  readonly created_at: string;
}

export type MatchCreate = Omit<Match, 'id' | 'created_at' | 'updated_at' | 'team'>;
export type MatchUpdate = Partial<Omit<MatchCreate, 'season_id' | 'season_cycle_id' | 'season_phase_id' | 'team_id'>>;
