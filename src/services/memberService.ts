import type { Member } from '@/types';

// Service-Layer Stub – wird mit Lovable Cloud / Supabase verbunden
export const memberService = {
  async getAll(): Promise<Member[]> {
    return [];
  },

  async getById(id: string): Promise<Member | null> {
    console.log('getById stub', id);
    return null;
  },

  async create(data: Partial<Member>): Promise<Member | null> {
    console.log('create stub', data);
    return null;
  },

  async update(id: string, data: Partial<Member>): Promise<Member | null> {
    console.log('update stub', id, data);
    return null;
  },

  async delete(id: string): Promise<boolean> {
    console.log('delete stub', id);
    return false;
  },
};
