import type { AppRole, Permission } from '@/types/auth';

export type NavGroup = 'sport' | 'club' | 'system';

export type AppModuleKey =
  | 'dashboard'
  | 'members'
  | 'teams'
  | 'matches'
  | 'schedule'
  | 'substitutes'
  | 'training'
  | 'communication'
  | 'board'
  | 'admin'
  | 'roles'
  | 'seasons'
  | 'settings'
  | 'import'
  | 'info'
  | 'profile'
  | 'auth';

export type RouteGuard =
  | { type: 'public' }
  | { type: 'authenticated' }
  | { type: 'permission'; permission: Permission }
  | { type: 'roles'; roles: AppRole[] };

export interface RouteConfig {
  path: string;
  module: AppModuleKey;
  label: string;
  icon?: React.ElementType;
  group: NavGroup;
  exact?: boolean;
  hideInSidebar?: boolean;
  guard: RouteGuard;
}
