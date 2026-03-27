import { supabase } from '@/integrations/supabase/client';
import type { Member } from '@/types';
import type {
  MemberCreateDTO,
  MemberUpdateDTO,
  MemberFilter,
  MemberUI,
} from '@/types/member';
import {
  memberCreateSchema,
  memberUpdateSchema,
  memberFilterSchema,
} from '@/schemas/member.schema';

const mapToUI = (row: Member): MemberUI => ({
  id: row.id,
  userId: row.user_id,
  firstName: row.first_name,
  lastName: row.last_name,
  fullName: `${row.first_name} ${row.last_name}`.trim(),
  email: row.email,
  phone: row.phone,
  city: row.city,
  zipCode: row.zip_code,
  street: row.street,
  memberNumber: row.member_number,
  ageGroup: row.age_group,
  entryDate: row.entry_date,
  exitDate: row.exit_date,
  isActive: row.is_active,
  ttr: row.ttr_rating,
  qttr: row.qttr_rating,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const handleError = (error: any, context: string) => {
  const message = error?.message ?? 'Unbekannter Fehler';
  throw new Error(`[memberService] ${context}: ${message}`);
};

export const memberService = {
  async list(filters: MemberFilter = {}): Promise<MemberUI[]> {
    const parsed = memberFilterSchema.safeParse(filters);
    if (!parsed.success) throw new Error(parsed.error.message);
    const { is_active, search, team_id } = parsed.data;

    // Team-Filter via Join, damit nur Mitglieder des Teams zurückkommen
    if (team_id) {
      const { data, error } = await supabase
        .from('team_members')
        .select('members(*)')
        .eq('team_id', team_id);
      if (error) handleError(error, 'list (team)');
      const rows = (data ?? [])
        .map((tm: any) => tm.members as Member)
        .filter(Boolean)
        .filter((m) => (is_active === undefined ? true : m.is_active === is_active))
        .filter((m) =>
          search
            ? [m.first_name, m.last_name, m.email].some((f) =>
                (f ?? '').toLowerCase().includes(search.toLowerCase()),
              )
            : true,
        );
      return rows.map(mapToUI);
    }

    let query = supabase.from('members').select('*');
    if (is_active !== undefined) query = query.eq('is_active', is_active);
    if (search) {
      const term = `%${search}%`;
      query = query.or(
        `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`,
      );
    }
    const { data, error } = await query.order('last_name', { ascending: true });
    if (error) handleError(error, 'list');
    return (data ?? []).map(mapToUI);
  },

  async getById(id: string): Promise<MemberUI | null> {
    const { data, error } = await supabase.from('members').select('*').eq('id', id).maybeSingle();
    if (error) handleError(error, 'getById');
    return data ? mapToUI(data) : null;
  },

  async getByUserId(userId: string): Promise<MemberUI | null> {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) handleError(error, 'getByUserId');
    return data ? mapToUI(data) : null;
  },

  async create(payload: MemberCreateDTO): Promise<MemberUI> {
    const parsed = memberCreateSchema.parse(payload);
    const { data, error } = await supabase
      .from('members')
      .insert(parsed as any)
      .select()
      .single();
    if (error) handleError(error, 'create');
    return mapToUI(data as Member);
  },

  async update(id: string, payload: MemberUpdateDTO): Promise<MemberUI> {
    const parsed = memberUpdateSchema.parse(payload);
    const { data, error } = await supabase
      .from('members')
      .update(parsed as any)
      .eq('id', id)
      .select()
      .single();
    if (error) handleError(error, 'update');
    return mapToUI(data as Member);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) handleError(error, 'remove');
  },
};
