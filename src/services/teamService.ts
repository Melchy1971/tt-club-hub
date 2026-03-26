import type { Team, TeamMember } from '@/types';

export const teamService = {
  async getAll(): Promise<Team[]> {
    return [];
  },

  async getById(id: string): Promise<Team | null> {
    console.log('getById stub', id);
    return null;
  },

  async create(data: Partial<Team>): Promise<Team | null> {
    console.log('create stub', data);
    return null;
  },

  async update(id: string, data: Partial<Team>): Promise<Team | null> {
    console.log('update stub', id, data);
    return null;
  },

  async delete(id: string): Promise<boolean> {
    console.log('delete stub', id);
    return false;
  },

  async getMembers(teamId: string): Promise<TeamMember[]> {
    console.log('getMembers stub', teamId);
    return [];
  },
};
