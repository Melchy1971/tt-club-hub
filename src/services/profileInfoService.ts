import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/types/auth';
import type {
  MemberProfilePermissionViewModel,
  MemberProfileViewModel,
  TeamTrainingTimeBadge,
  PublicClubInfoViewModel,
} from '@/types/viewModels';

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
  teams: 'team_members + teams + season_phases: all teams for member_id',
  teamRoster: 'team_members: all member assignments for requested teams',
  teamTraining: 'training_bookings: upcoming team-relevant bookings via requester/partner',
} as const;

const handleError = (error: { message?: string } | null, context: string) => {
  if (!error) return;
  throw new Error(`[profileInfoService] ${context}: ${error.message ?? 'Unbekannter Fehler'}`);
};

export const profileInfoService = {
  queryPlan: PROFILE_QUERY_PLAN,

  async getMemberProfileViewModel(userId: string): Promise<MemberProfileViewModel | null> {
    return this.buildMemberProfileViewModel({ requesterUserId: userId, targetUserId: userId });
  },

  async getMemberProfileViewModelByMemberId(
    requesterUserId: string,
    targetMemberId: string,
  ): Promise<MemberProfileViewModel | null> {
    return this.buildMemberProfileViewModel({ requesterUserId, targetMemberId });
  },

  resolveProfilePermissions({
    requesterRoles,
    isSelf,
  }: {
    requesterRoles: AppRole[];
    isSelf: boolean;
  }): MemberProfilePermissionViewModel {
    const elevated = requesterRoles.some((role) => role === 'admin' || role === 'vorstand' || role === 'developer');
    const selfServiceMode = !elevated || isSelf;

    return {
      mode: selfServiceMode ? 'self-service' : 'admin-board',
      canEditPersonalData: isSelf || elevated,
      canManageRoles: elevated && !isSelf,
      canManageTeamAssignments: elevated && !isSelf,
      canChangeOwnPassword: isSelf,
      canManageSecurityForOthers: elevated && !isSelf,
    };
  },

  async buildMemberProfileViewModel({
    requesterUserId,
    targetUserId,
    targetMemberId,
  }: {
    requesterUserId: string;
    targetUserId?: string;
    targetMemberId?: string;
  }): Promise<MemberProfileViewModel | null> {
    let memberQuery = supabase.from('members').select('*');
    if (targetMemberId) memberQuery = memberQuery.eq('id', targetMemberId);
    else if (targetUserId) memberQuery = memberQuery.eq('user_id', targetUserId);
    else throw new Error('[profileInfoService] buildMemberProfileViewModel: target fehlt');

    const { data: member, error: memberError } = await memberQuery.maybeSingle();
    handleError(memberError, 'buildMemberProfileViewModel.member');

    if (!member) return null;

    const [{ data: targetRoleRows, error: targetRoleError }, { data: requesterRoleRows, error: requesterRoleError }, { data: teamRows, error: teamError }] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', member.user_id),
      supabase.from('user_roles').select('role').eq('user_id', requesterUserId),
      supabase
        .from('team_members')
        .select('team_id, position, teams(name, league, age_group, division, captain_id, season_phase_id, season_phases(name))')
        .eq('member_id', member.id),
    ]);

    handleError(targetRoleError, 'buildMemberProfileViewModel.roles.target');
    handleError(requesterRoleError, 'buildMemberProfileViewModel.roles.requester');
    handleError(teamError, 'buildMemberProfileViewModel.teams');

    const teamIds = (teamRows ?? []).map((row) => row.team_id);
    const teamRosterByTeamId = new Map<string, string[]>();

    if (teamIds.length > 0) {
      const { data: teamRosterRows, error: teamRosterError } = await supabase
        .from('team_members')
        .select('team_id, member_id')
        .in('team_id', teamIds);

      handleError(teamRosterError, 'buildMemberProfileViewModel.teamRoster');

      (teamRosterRows ?? []).forEach((row) => {
        const existing = teamRosterByTeamId.get(row.team_id) ?? [];
        existing.push(row.member_id);
        teamRosterByTeamId.set(row.team_id, existing);
      });
    }

    const uniqueTeamMemberIds = Array.from(new Set(Array.from(teamRosterByTeamId.values()).flatMap((ids) => ids)));

    let teamRelatedTrainingRows: Array<any> = [];
    if (uniqueTeamMemberIds.length > 0) {
      const fromDate = new Date().toISOString().slice(0, 10);
      const [{ data: requesterRows, error: requesterTrainingError }, { data: partnerRows, error: partnerTrainingError }] = await Promise.all([
        supabase
          .from('training_bookings')
          .select('id, booking_date, start_time, end_time, location, status, requester_id, partner_id')
          .in('requester_id', uniqueTeamMemberIds)
          .gte('booking_date', fromDate)
          .in('status', ['pending', 'confirmed']),
        supabase
          .from('training_bookings')
          .select('id, booking_date, start_time, end_time, location, status, requester_id, partner_id')
          .in('partner_id', uniqueTeamMemberIds)
          .gte('booking_date', fromDate)
          .in('status', ['pending', 'confirmed']),
      ]);

      handleError(requesterTrainingError, 'buildMemberProfileViewModel.teamTraining.requester');
      handleError(partnerTrainingError, 'buildMemberProfileViewModel.teamTraining.partner');

      const byId = new Map<string, any>();
      [...(requesterRows ?? []), ...(partnerRows ?? [])].forEach((row) => {
        byId.set(row.id, row);
      });
      teamRelatedTrainingRows = Array.from(byId.values());
    }

    const mapTrainingTime = (row: any): TeamTrainingTimeBadge => ({
      id: row.id,
      bookingDate: row.booking_date,
      startTime: row.start_time,
      endTime: row.end_time ?? null,
      location: row.location ?? null,
      status: row.status,
    });

    const teams = (teamRows ?? []).map((row) => {
      const team = row.teams as any;
      const rosterIds = new Set(teamRosterByTeamId.get(row.team_id) ?? []);
      const teamTrainingTimes = teamRelatedTrainingRows
        .filter((training) => rosterIds.has(training.requester_id) || rosterIds.has(training.partner_id))
        .sort((a, b) => `${a.booking_date}T${a.start_time}`.localeCompare(`${b.booking_date}T${b.start_time}`))
        .slice(0, 5)
        .map(mapTrainingTime);

      return {
        teamId: row.team_id,
        name: team?.name ?? 'Unbenanntes Team',
        league: team?.league ?? null,
        ageGroup: team?.age_group ?? null,
        division: team?.division ?? null,
        position: row.position ?? 0,
        isCaptain: team?.captain_id === member.id,
        seasonPhaseId: team?.season_phase_id ?? null,
        seasonPhaseName: team?.season_phases?.name ?? null,
        trainingTimes: teamTrainingTimes,
      };
    });

    const teamGroupsMap = new Map<string, MemberProfileViewModel['teamGroups'][number]>();
    teams.forEach((team) => {
      const key = `${team.ageGroup ?? 'none'}::${team.seasonPhaseId ?? 'none'}`;
      if (!teamGroupsMap.has(key)) {
        teamGroupsMap.set(key, {
          ageGroup: team.ageGroup,
          seasonPhaseId: team.seasonPhaseId,
          seasonPhaseName: team.seasonPhaseName,
          teams: [],
        });
      }
      teamGroupsMap.get(key)!.teams.push(team);
    });

    const permissions = this.resolveProfilePermissions({
      requesterRoles: (requesterRoleRows ?? []).map((row) => row.role).filter((role): role is AppRole => !!role),
      isSelf: requesterUserId === member.user_id,
    });

    return {
      member,
      roles: (targetRoleRows ?? [])
        .map((row) => row.role)
        .filter((role): role is AppRole => !!role)
        .map((role) => ({ role, label: ROLE_LABELS[role] ?? role })),
      teams,
      teamGroups: Array.from(teamGroupsMap.values()),
      permissions,
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
