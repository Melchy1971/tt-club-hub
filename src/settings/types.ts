import type { Permission } from '@/types/auth';
import type { AppRole } from '@/types/auth';

export type SettingsSubpageId =
  | 'general'
  | 'roles'
  | 'profile'
  | 'club'
  | 'season'
  | 'venues'
  | 'appearance'
  | 'notifications'
  | 'privacy'
  | 'security'
  | 'backup'
  | 'danger'
  | 'developer';

export type SettingsSubpageGroup = 'account' | 'club' | 'admin';

export interface SettingsSubpageDef {
  id: SettingsSubpageId;
  label: string;
  icon: React.ElementType;
  component: React.ComponentType;
  group: SettingsSubpageGroup;
  /**
   * Read-level access check for page visibility.
   */
  requiredPermission?: Permission;
  /**
   * Optional strict role lock (e.g. developer-only area).
   */
  requiredRole?: AppRole;
  /**
   * Optional stronger write permission used by forms/actions.
   */
  writePermission?: Permission;
}

export interface SettingsAccessContext {
  role: AppRole | null | undefined;
}
