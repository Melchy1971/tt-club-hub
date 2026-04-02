import type { ModuleKey, PermissionLevel } from '@/constants/permissionsMatrix';
import { ROLE_LABELS_DE } from '@/constants/uiLabels';
import { getPermissionLevelLabelsDe } from '@/lib/auth/permissionsResolver';
import type { AppRole } from '@/types/auth';

export const APP_ROLE_LABELS: Record<AppRole, string> = ROLE_LABELS_DE;

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: 'Übersicht',
  teams: 'Mannschaften',
  schedule: 'Spielplan',
  members: 'Mitglieder',
  communication: 'Kommunikation',
  board: 'Vorstand',
  settings: 'Einstellungen',
  import: 'Import',
};

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = getPermissionLevelLabelsDe;

const FALLBACK_MODULE_LABEL = 'Unbekanntes Modul';

export const getModuleLabel = (module: string): string => {
  if (module in MODULE_LABELS) {
    return MODULE_LABELS[module as ModuleKey];
  }

  return `${FALLBACK_MODULE_LABEL} (${module})`;
};
