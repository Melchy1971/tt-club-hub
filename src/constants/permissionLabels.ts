import type { AppRole } from '@/types/auth';
import type { ModuleKey, PermissionLevel } from '@/constants/permissionsMatrix';

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  developer: 'Entwickler',
  admin: 'Administrator',
  vorstand: 'Vorstand',
  trainer: 'Trainer',
  spieler: 'Spieler',
  mitglied: 'Mitglied',
};

export const MODULE_LABELS: Record<ModuleKey, string> = {
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

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = {
  none: 'Keine',
  read: 'Lesen',
  write: 'Schreiben',
};

const FALLBACK_MODULE_LABEL = 'Unbekanntes Modul';

export const getModuleLabel = (module: string): string => {
  if (module in MODULE_LABELS) {
    return MODULE_LABELS[module as ModuleKey];
  }

  return `${FALLBACK_MODULE_LABEL} (${module})`;
};
