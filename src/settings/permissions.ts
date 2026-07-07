import type { Permission } from '@/types/auth';
import type { SettingsAccessRule, SettingsSubpageId } from './types';

export interface SettingsPermissionRule {
  read?: SettingsAccessRule;
  write?: SettingsAccessRule;
}

export const SETTINGS_PERMISSION_MODEL: Record<SettingsSubpageId, SettingsPermissionRule> = {
  roles: { read: { permissions: ['admin:all'] }, write: { permissions: ['admin:all'] } },
  permissions: { read: { permissions: ['admin:all'] }, write: { permissions: ['admin:all'] } },
  profile: {},
  club: { read: { permissions: ['settings:read'] }, write: { permissions: ['settings:write'] } },
  season: { read: { permissions: ['settings:read'] }, write: { permissions: ['settings:write'] } },
  venues: { read: { permissions: ['settings:read'] }, write: { permissions: ['settings:write'] } },
  appearance: {},
  notifications: {},
  privacy: {},
  security: {},
  backup: { read: { permissions: ['admin:all'] }, write: { permissions: ['admin:all'] } },
  agent_integrations: { read: { permissions: ['admin:all'] }, write: { permissions: ['admin:all'] } },
  danger: { read: { permissions: ['admin:all'] }, write: { permissions: ['admin:all'] } },
};

export function getSettingsPermissionRule(id: SettingsSubpageId): SettingsPermissionRule {
  return SETTINGS_PERMISSION_MODEL[id];
}
