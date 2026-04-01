import type { Permission } from '@/types/auth';
import type { SettingsSubpageId } from './types';

export interface SettingsPermissionRule {
  read?: Permission;
  write?: Permission;
}

export const SETTINGS_PERMISSION_MODEL: Record<SettingsSubpageId, SettingsPermissionRule> = {
  general: {},
  roles: { read: 'admin:all', write: 'admin:all' },
  profile: {},
  club: { read: 'settings:read', write: 'settings:write' },
  season: { read: 'settings:read', write: 'settings:write' },
  venues: { read: 'settings:read', write: 'settings:write' },
  appearance: {},
  notifications: {},
  privacy: {},
  security: {},
  backup: { read: 'admin:all', write: 'admin:all' },
  danger: { read: 'admin:all', write: 'admin:all' },
};

export function getSettingsPermissionRule(id: SettingsSubpageId): SettingsPermissionRule {
  return SETTINGS_PERMISSION_MODEL[id];
}
