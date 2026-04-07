import type { ModuleKey, PermissionLevel } from '@/constants/permissionsMatrix';
import { PERMISSION_LEVEL_LABELS_DE, PERMISSION_MODULE_LABELS_DE, ROLE_LABELS_DE, getPermissionModuleLabel } from '@/constants/uiLabels';
import type { AppRole } from '@/types/auth';

export const APP_ROLE_LABELS: Record<AppRole, string> = ROLE_LABELS_DE;

export const MODULE_LABELS: Record<ModuleKey, string> = PERMISSION_MODULE_LABELS_DE;

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = PERMISSION_LEVEL_LABELS_DE;

const FALLBACK_MODULE_LABEL = 'Unbekanntes Modul';

export const getModuleLabel = (module: string): string => {
  const resolved = getPermissionModuleLabel(module);
  return resolved.startsWith('Unbekanntes Modul') ? `${FALLBACK_MODULE_LABEL} (${module})` : resolved;
};
