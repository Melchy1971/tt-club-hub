import { supabase } from '@/integrations/supabase/client';
import { err, ok } from '@/lib/api';
import { fromSupabaseError } from '@/lib/error';
import type { ApiResult, MemberId } from '@/types/api';
import type { Member, MemberCreate, MemberUpdate } from '@/types/domain/member';

// Typcast-Helfer, da Supabase-Types noch nicht mit dem Schema synchronisiert sind.
// TODO: Nach `supabase gen types typescript` entfernen und echte DB-Typen verwenden.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cast = <T>(v: unknown): T => v as T;

export const memberService = {
  async getAll(): Promise<ApiResult<Member[]>> {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('last_name');
    if (error) return err(fromSupabaseError(error));
    return ok(cast<Member[]>(data));
  },

  async getById(id: MemberId): Promise<ApiResult<Member>> {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return err(fromSupabaseError(error));
    return ok(cast<Member>(data));
  },

  async create(input: MemberCreate): Promise<ApiResult<Member>> {
    const { data, error } = await supabase
      .from('members')
      .insert(input)
      .select()
      .single();
    if (error) return err(fromSupabaseError(error));
    return ok(cast<Member>(data));
  },

  async update(id: MemberId, input: MemberUpdate): Promise<ApiResult<Member>> {
    const { data, error } = await supabase
      .from('members')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return err(fromSupabaseError(error));
    return ok(cast<Member>(data));
  },

  async delete(id: MemberId): Promise<ApiResult<void>> {
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) return err(fromSupabaseError(error));
    return ok(undefined);
  },
};
