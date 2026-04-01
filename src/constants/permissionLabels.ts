import type { ModuleKey, PermissionLevel } from '@/constants/permissionsMatrix';
import { getModuleLabel, ROLE_LABELS_DE } from '@/constants/uiLabels';
import type { AppRole } from '@/types/auth';

export const APP_ROLE_LABELS: Record<AppRole, string> = ROLE_LABELS_DE;

export const MODULE_LABELS: Record<ModuleKey, string> = {
  members: getModuleLabel('members'),
  teams: getModuleLabel('teams'),
  matches: getModuleLabel('matches'),
  schedule: getModuleLabel('schedule'),
  seasons: getModuleLabel('seasons'),
  training: getModuleLabel('training'),
  substitutes: getModuleLabel('substitutes'),
  communication: getModuleLabel('communication'),
  board: getModuleLabel('board'),
  settings: getModuleLabel('settings'),
  import: getModuleLabel('import'),
  admin: getModuleLabel('admin'),
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
