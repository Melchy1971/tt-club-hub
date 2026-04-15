import type { AppRole } from '@/types/auth';

export const PERMISSION_LEVELS = ['NONE', 'READ', 'WRITE'] as const;
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

export const MODULE_KEYS = [
  'dashboard',
  'teams',
  'schedule',
  'members',
  'communication',
  'board',
  'settings',
  'import',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const SYSTEM_APP_ROLES: readonly AppRole[] = [
  'developer',
  'admin',
  'vorstand',
  'trainer',
  'spieler',
  'mitglied',
  'fördermitglied',
] as const;

export const isPermissionLevel = (value: string): value is PermissionLevel =>
  (PERMISSION_LEVELS as readonly string[]).includes(value);

export const isModuleKey = (value: string): value is ModuleKey =>
  (MODULE_KEYS as readonly string[]).includes(value);

export const SYSTEM_APP_ROLE_PERMISSIONS: Record<string, Record<ModuleKey, PermissionLevel>> = {
  developer: {
    dashboard: 'WRITE',
    teams: 'WRITE',
    schedule: 'WRITE',
    members: 'WRITE',
    communication: 'WRITE',
    board: 'WRITE',
    settings: 'WRITE',
    import: 'WRITE',
  },
  admin: {
    dashboard: 'WRITE',
    teams: 'WRITE',
    schedule: 'WRITE',
    members: 'WRITE',
    communication: 'WRITE',
    board: 'WRITE',
    settings: 'WRITE',
    import: 'WRITE',
  },
  vorstand: {
    dashboard: 'READ',
    teams: 'WRITE',
    schedule: 'WRITE',
    members: 'WRITE',
    communication: 'WRITE',
    board: 'WRITE',
    settings: 'WRITE',
    import: 'READ',
  },
  trainer: {
    dashboard: 'READ',
    teams: 'WRITE',
    schedule: 'WRITE',
    members: 'READ',
    communication: 'READ',
    board: 'NONE',
    settings: 'NONE',
    import: 'NONE',
  },
  spieler: {
    dashboard: 'READ',
    teams: 'READ',
    schedule: 'READ',
    members: 'READ',
    communication: 'READ',
    board: 'NONE',
    settings: 'NONE',
    import: 'NONE',
  },
  mitglied: {
    dashboard: 'READ',
    teams: 'READ',
    schedule: 'READ',
    members: 'READ',
    communication: 'NONE',
    board: 'NONE',
    settings: 'NONE',
    import: 'NONE',
  },
  fördermitglied: {
    dashboard: 'READ',
    teams: 'READ',
    schedule: 'READ',
    members: 'READ',
    communication: 'NONE',
    board: 'NONE',
    settings: 'NONE',
    import: 'NONE',
  },
};
