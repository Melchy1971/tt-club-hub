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
}

export interface MemberProfileViewModel {
  member: Tables<'members'>;
  roles: MemberRoleBadge[];
  teams: MemberTeamBadge[];
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
