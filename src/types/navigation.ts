import type { AppRole, Permission } from '@/types/auth';
import type { ModuleKey } from '@/constants/permissionsMatrix';

export type NavGroup = 'personal' | 'sport' | 'club' | 'system';

export type NavVisibility = 'sidebar' | 'hidden' | 'settings';

export type AppModuleKey =
  | 'dashboard'
  | 'members'
  | 'teams'
  | 'matches'
  | 'schedule'
  | 'substitutes'
  | 'training'
  | 'standings'
  | 'communication'
  | 'board'
  | 'admin'
  | 'roles'
  | 'seasons'
  | 'settings'
  | 'import'
  | 'info'
  | 'profile'
  | 'security'
  | 'notifications'
  | 'privacy'
  | 'auth';

export type RouteGuard =
  | { type: 'public' }
  | { type: 'authenticated' }
  | { type: 'permission'; permission: Permission }
  | { type: 'roles'; roles: AppRole[] }
  | { type: 'module'; module: ModuleKey; level?: 'READ' | 'WRITE' };

export interface RouteConfig {
  path: string;
  moduleKey: AppModuleKey;
  label: string;
  icon?: React.ElementType;
  group: NavGroup;
  navVisibility: NavVisibility;
  exact?: boolean;
  guard: RouteGuard;
}
