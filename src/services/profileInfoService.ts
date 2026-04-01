import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/types/auth';
import type { MemberProfileViewModel, PublicClubInfoViewModel } from '@/types/viewModels';

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  vorstand: 'Vorstand',
  trainer: 'Trainer',
  spieler: 'Spieler',
  mitglied: 'Mitglied',
  developer: 'Developer',
};

const PROFILE_QUERY_PLAN = {
  member: 'members: by user_id (exactly one row)',
  roles: 'user_roles: all roles for user_id',
  teams: 'team_members + teams: all teams for member_id',
} as const;

const handleError = (error: { message?: string } | null, context: string) => {
  if (!error) return;
  throw new Error(`[profileInfoService] ${context}: ${error.message ?? 'Unbekannter Fehler'}`);
};

export const profileInfoService = {
  queryPlan: PROFILE_QUERY_PLAN,

  async getMemberProfileViewModel(userId: string): Promise<MemberProfileViewModel | null> {
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    handleError(memberError, 'getMemberProfileViewModel.member');

    if (!member) return null;

    const [{ data: roleRows, error: roleError }, { data: teamRows, error: teamError }] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', userId),
      supabase
        .from('team_members')
        .select('team_id, position, teams(name, league, age_group, division, captain_id, season_phase_id, season_phases(name))')
        .eq('member_id', member.id),
    ]);

    handleError(roleError, 'getMemberProfileViewModel.roles');
    handleError(teamError, 'getMemberProfileViewModel.teams');

    return {
      member,
      roles: (roleRows ?? [])
        .map((row) => row.role)
        .filter((role): role is AppRole => !!role)
        .map((role) => ({ role, label: ROLE_LABELS[role] ?? role })),
      teams: (teamRows ?? []).map((row) => {
        const team = row.teams as any;
        return {
          teamId: row.team_id,
          name: team?.name ?? 'Unbenanntes Team',
          league: team?.league ?? null,
          ageGroup: team?.age_group ?? null,
          division: team?.division ?? null,
          position: row.position ?? 0,
          isCaptain: team?.captain_id === member.id,
          seasonPhaseName: team?.season_phases?.name ?? null,
        };
      }),
    };
  },

  async getPublicClubInfo(): Promise<PublicClubInfoViewModel | null> {
    const { data, error } = await supabase
      .from('club_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    handleError(error, 'getPublicClubInfo');

    if (!data) return null;

    return {
      clubName: data.club_name,
      clubNumber: data.club_number ?? null,
      association: data.association ?? null,
      website: data.website ?? null,
      contactEmail: data.contact_email ?? null,
      contactPhone: data.contact_phone ?? null,
      street: data.street ?? null,
      zipCode: data.zip_code ?? null,
      city: data.city ?? null,
    };
  },
};
