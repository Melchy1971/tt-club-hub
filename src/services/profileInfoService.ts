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
        .select('team_id, teams(name, league)')
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
      teams: (teamRows ?? []).map((row) => ({
        teamId: row.team_id,
        name: row.teams?.name ?? 'Unbenanntes Team',
        league: row.teams?.league ?? null,
      })),
    };
  },

  async getPublicClubInfo(): Promise<PublicClubInfoViewModel | null> {
    const { data, error } = await supabase
      .from('club_public_info')
      .select('*')
      .limit(1)
      .maybeSingle();

    handleError(error, 'getPublicClubInfo');

    if (!data) return null;

    return {
      clubName: data.club_name,
      clubNumber: data.club_number,
      association: data.association,
      website: data.website,
      contactEmail: data.contact_email,
      contactPhone: data.contact_phone,
      street: data.street,
      zipCode: data.zip_code,
      city: data.city,
    };
  },
};
