import type { AppRole } from '@/types/auth';

export const PERMISSION_LEVELS = ['none', 'read', 'write'] as const;
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];
export const MODULE_KEYS = [
  'members',
  'teams',
  'matches',
  'schedule',
  'seasons',
  'training',
  'substitutes',
  'communication',
  'board',
  'settings',
  'import',
  'admin',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
export const SYSTEM_APP_ROLES: readonly AppRole[] = [
  'developer',
  'admin',
  'vorstand',
  'trainer',
  'spieler',
  'mitglied',
] as const;

export const isPermissionLevel = (value: string): value is PermissionLevel =>
  (PERMISSION_LEVELS as readonly string[]).includes(value);

export const isModuleKey = (value: string): value is ModuleKey =>
  (MODULE_KEYS as readonly string[]).includes(value);
