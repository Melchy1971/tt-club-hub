import type { Permission } from '@/types/auth';

export type SettingsSubpageId =
  | 'roles'
  | 'permissions'
  | 'profile'
  | 'club'
  | 'season'
  | 'venues'
  | 'appearance'
  | 'notifications'
  | 'privacy'
  | 'security'
  | 'backup'
  | 'danger';

export type SettingsSubpageGroup = 'account' | 'club' | 'admin';

export interface SettingsAccessRule {
  permissions?: Permission[];
  mode?: 'any' | 'all';
}

export interface SettingsSubpageDef {
  id: SettingsSubpageId;
  label: string;
  icon: React.ElementType;
  component: React.ComponentType;
  group: SettingsSubpageGroup;
  readAccess?: SettingsAccessRule;
  writeAccess?: SettingsAccessRule;
}

export interface SettingsAccessContext {
  role: string | null | undefined;
  permissions?: Permission[];
}
