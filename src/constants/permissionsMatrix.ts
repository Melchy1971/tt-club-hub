import type { Database } from '@/integrations/supabase/types';

export const PERMISSION_LEVELS = ['none', 'read', 'write'] as const;

export type PermissionLevel = Database['public']['Enums']['permission_level'];
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

export const moduleLabels: Record<ModuleKey, string> = {
  members: 'Mitglieder',
  teams: 'Mannschaften',
  matches: 'Spiele',
  schedule: 'Spielplan',
  seasons: 'Saisons',
  training: 'Training',
  substitutes: 'Ersatzstellung',
  communication: 'Kommunikation',
  board: 'Vorstand',
  settings: 'Einstellungen',
  import: 'Import',
  admin: 'Administration',
};

export const permissionLabels: Record<PermissionLevel, string> = {
  none: 'Keine',
  read: 'Lesen',
  write: 'Schreiben',
};

export const isPermissionLevel = (value: string): value is PermissionLevel =>
  (PERMISSION_LEVELS as readonly string[]).includes(value);

export const fallbackModuleLabel = 'Unbekanntes Modul';

export const getModuleLabel = (module: string): string => {
  if (module in moduleLabels) {
    return moduleLabels[module as ModuleKey];
  }

  return `${fallbackModuleLabel} (${module})`;
};
