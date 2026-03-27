// === Auth / Rollen ===
export type { AppRole, AuthUser, Permission } from './auth';
export { APP_ROLES, ROLE_PERMISSIONS } from './auth';

// === API / Result-Typen ===
export type {
  ApiResult,
  AppError,
  AppErrorCode,
  Err,
  MatchId,
  MemberId,
  Ok,
  PaginatedData,
  PaginatedResult,
  PaginationParams,
  SeasonId,
  TeamId,
} from './api';
export { asMatchId, asMemberId, asSeasonId, asTeamId } from './api';

// === Domain-Typen ===
export type { Member, MemberCreate, MemberGender, MemberStatus, MemberUpdate } from './domain/member';
export { memberFullName } from './domain/member';

export type { Team, TeamCreate, TeamMember, TeamUpdate } from './domain/team';

export type { Match, MatchCreate, MatchStatus, MatchUpdate, SingleMatch } from './domain/match';

export type { AgeGroup, Season, SeasonCreate, SeasonUpdate } from './domain/season';

// === Dashboard ===
export interface DashboardStats {
  totalMembers: number;
  activeTeams: number;
  upcomingMatches: number;
  seasonWinRate: number;
}
