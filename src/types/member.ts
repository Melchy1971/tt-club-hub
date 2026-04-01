import type { Member } from '@/types'; // Supabase table row

export interface MemberUI {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  birthdate: string | null;
  city: string | null;
  zipCode: string | null;
  street: string | null;
  memberNumber: string | null;
  ageGroup: Member['age_group'];
  entryDate: string | null;
  exitDate: string | null;
  isActive: boolean;
  ttr: number | null;
  qttr: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type MemberCreateDTO = {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  date_of_birth?: string | null;
  gender?: Member['gender'] | null;
  street?: string | null;
  zip_code?: string | null;
  city?: string | null;
  member_number?: string | null;
  entry_date?: string | null;
  exit_date?: string | null;
  is_active?: boolean;
  ttr_rating?: number | null;
  qttr_rating?: number | null;
  age_group?: Member['age_group'] | null;
  user_id?: string | null;
};

export type MemberUpdateDTO = Partial<MemberCreateDTO>;

export interface MemberFilter {
  is_active?: boolean;
  search?: string;
  team_id?: string;
}
