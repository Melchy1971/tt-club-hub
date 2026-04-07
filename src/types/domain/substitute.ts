import type { MatchId, MemberId, SeasonPhaseId, TeamId } from '../api';

// ─── Status ───────────────────────────────────────────────────────────────────
// DB-Enum substitute_status enthält: pending | accepted | rejected
// 'cancelled' erfordert eine DB-Migration:
//   ALTER TYPE substitute_status ADD VALUE 'cancelled';

export type SubstituteRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

// ─── Kern-Entität (spiegelt DB-Zeile wider) ───────────────────────────────────

export interface SubstituteRequest {
  readonly id: string;
  match_id: MatchId;
  team_id: TeamId;
  /** Mitglied, das die Anfrage stellt (i.d.R. Trainer oder Kapitän). */
  requesting_member_id: MemberId;
  /** Angefragter Ersatzspieler. */
  substitute_member_id: MemberId;
  status: SubstituteRequestStatus;
  note: string | null;
  readonly created_by: string;
  readonly created_at: string;
  readonly updated_at: string;
}

// ─── UI-Typ (angereichert mit Joins) ─────────────────────────────────────────

export interface SubstituteRequestUI extends SubstituteRequest {
  /** Aus schedule_matches.season_phase_id abgeleitet. */
  season_phase_id: SeasonPhaseId | null;
  requesting_member: { first_name: string; last_name: string } | null;
  substitute_member: { first_name: string; last_name: string } | null;
  match: {
    match_date: string;
    home_team: string;
    away_team: string;
    season_phase_id: string | null;
  } | null;
}

// ─── Abgeleitete Hilfstypen ───────────────────────────────────────────────────

export type SubstituteRequestCreate = Omit<
  SubstituteRequest,
  'id' | 'status' | 'created_at' | 'updated_at'
>;
