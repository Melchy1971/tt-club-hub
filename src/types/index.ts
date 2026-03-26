// === Rollen ===
export type AppRole = 'admin' | 'vorstand' | 'trainer' | 'spieler' | 'mitglied' | 'developer';

// === Mitglieder ===
export interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  gender?: 'männlich' | 'weiblich' | 'divers';
  street?: string;
  zip_code?: string;
  city?: string;
  member_number?: string;
  entry_date: string;
  exit_date?: string;
  is_active: boolean;
  ttr_rating?: number;
  qttr_rating?: number;
  club_id?: string;
  created_at: string;
  updated_at: string;
}

// === Mannschaften ===
export interface Team {
  id: string;
  name: string;
  league: string;
  season_id: string;
  division?: string;
  captain_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  member_id: string;
  position: number;
  member?: Member;
}

// === Saison ===
export interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

// === Spielbetrieb ===
export interface Match {
  id: string;
  season_id: string;
  team_id: string;
  match_day: number;
  date: string;
  time?: string;
  home_team: string;
  away_team: string;
  home_score?: number;
  away_score?: number;
  venue?: string;
  is_home: boolean;
  status: 'geplant' | 'laufend' | 'beendet' | 'verschoben';
  created_at: string;
  updated_at: string;
  team?: Team;
}

export interface SingleMatch {
  id: string;
  match_id: string;
  position: number;
  home_player_id?: string;
  away_player_name?: string;
  sets_home: number;
  sets_away: number;
  set_results?: string;
  home_player?: Member;
}

// === Dashboard ===
export interface DashboardStats {
  totalMembers: number;
  activeTeams: number;
  upcomingMatches: number;
  seasonWinRate: number;
}
