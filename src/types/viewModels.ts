import type { Tables } from '@/integrations/supabase/types';
import type { AppRole } from '@/types/auth';

export interface MemberRoleBadge {
  role: AppRole;
  label: string;
}

export interface MemberTeamBadge {
  teamId: string;
  name: string;
  league: string | null;
  ageGroup: string | null;
  position: number;
  isCaptain: boolean;
  seasonPhaseId: string | null;
  seasonPhaseName: string | null;
  trainingTimes: TeamTrainingTimeBadge[];
}

export interface TeamTrainingTimeBadge {
  id: string;
  bookingDate: string;
  startTime: string;
  endTime: string | null;
  location: string | null;
  status: 'pending' | 'confirmed' | 'cancelled';
}

export interface MemberTeamGroupViewModel {
  ageGroup: string | null;
  seasonPhaseId: string | null;
  seasonPhaseName: string | null;
  teams: MemberTeamBadge[];
}

export interface MemberProfilePermissionViewModel {
  mode: 'self-service' | 'admin-board';
  canEditPersonalData: boolean;
  canManageRoles: boolean;
  canManageTeamAssignments: boolean;
  canChangeOwnPassword: boolean;
  canManageSecurityForOthers: boolean;
}

export interface MemberProfileViewModel {
  member: Tables<'members'>;
  roles: MemberRoleBadge[];
  teams: MemberTeamBadge[];
  teamGroups: MemberTeamGroupViewModel[];
  permissions: MemberProfilePermissionViewModel;
}

export interface PublicClubInfoViewModel {
  clubName: string;
  clubNumber: string | null;
  association: string | null;
  website: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  street: string | null;
  zipCode: string | null;
  city: string | null;
}


export interface InternalClubInfoViewModel {
  id: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ToolMetadataViewModel {
  version: string;
  buildDate: string;
  supportEmail: string;
}

export type LicenseStatus = 'active' | 'inactive' | 'expired' | 'revoked';

export interface LicenseViewModel {
  serialKey: string;
  status: LicenseStatus;
  activatedAt: string | null;
  validUntil: string | null;
}

export interface DeveloperInfoViewModel {
  toolMetadata: ToolMetadataViewModel | null;
  license: LicenseViewModel | null;
  internalClubInfo: InternalClubInfoViewModel | null;
}
