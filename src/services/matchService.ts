import type { Match } from '@/types';

export const matchService = {
  async getAll(): Promise<Match[]> {
    return [];
  },

  async getByTeam(teamId: string): Promise<Match[]> {
    console.log('getByTeam stub', teamId);
    return [];
  },

  async getById(id: string): Promise<Match | null> {
    console.log('getById stub', id);
    return null;
  },

  async create(data: Partial<Match>): Promise<Match | null> {
    console.log('create stub', data);
    return null;
  },

  async update(id: string, data: Partial<Match>): Promise<Match | null> {
    console.log('update stub', id, data);
    return null;
  },

  async delete(id: string): Promise<boolean> {
    console.log('delete stub', id);
    return false;
  },
};
