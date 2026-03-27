import type { MemberId } from '../api';

export type MemberGender = 'männlich' | 'weiblich' | 'divers';
export type MemberStatus = 'aktiv' | 'passiv' | 'ausgetreten';

export interface Member {
  readonly id: MemberId;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null; // ISO-Datum (YYYY-MM-DD)
  gender: MemberGender | null;
  street: string | null;
  zip_code: string | null;
  city: string | null;
  member_number: string | null;
  entry_date: string; // ISO-Datum
  exit_date: string | null;
  is_active: boolean;
  ttr_rating: number | null;
  qttr_rating: number | null;
  club_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export type MemberCreate = Omit<Member, 'id' | 'created_at' | 'updated_at'>;
export type MemberUpdate = Partial<MemberCreate>;

/** Voller Name als Hilfsfunktion */
export const memberFullName = (m: Pick<Member, 'first_name' | 'last_name'>): string =>
  `${m.first_name} ${m.last_name}`;
