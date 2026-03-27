import type { Enums, Tables } from '@/integrations/supabase/types';

// === Rollen ===
export const APP_ROLES = [
  'admin',
  'vorstand',
  'trainer',
  'spieler',
  'mitglied',
  'developer',
] as const;

export type AppRole = Enums<'app_role'>;
export type RoleRow = Tables<'roles'>;
export type UserRoleRow = Tables<'user_roles'>;

// === Berechtigungen ===
export type Permission =
  | 'member:read'
  | 'member:write'
  | 'member:delete'
  | 'team:read'
  | 'team:write'
  | 'team:delete'
  | 'match:read'
  | 'match:write'
  | 'match:delete'
  | 'season:read'
  | 'season:write'
  | 'season:delete'
  | 'training:read'
  | 'training:write'
  | 'substitute:read'
  | 'substitute:write'
  | 'substitute:approve'
  | 'settings:read'
  | 'settings:write'
  | 'admin:all';

const ALL_PERMISSIONS: Permission[] = [
  'member:read',
  'member:write',
  'member:delete',
  'team:read',
  'team:write',
  'team:delete',
  'match:read',
  'match:write',
  'match:delete',
  'season:read',
  'season:write',
  'season:delete',
  'training:read',
  'training:write',
  'substitute:read',
  'substitute:write',
  'substitute:approve',
  'settings:read',
  'settings:write',
  'admin:all',
];

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  developer: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  vorstand: [
    'member:read',
    'member:write',
    'member:delete',
    'team:read',
    'team:write',
    'team:delete',
    'match:read',
    'match:write',
    'season:read',
    'season:write',
    'training:read',
    'substitute:read',
    'substitute:approve',
    'settings:read',
    'settings:write',
  ],
  trainer: [
    'member:read',
    'team:read',
    'team:write',
    'match:read',
    'match:write',
    'training:read',
    'training:write',
    'substitute:read',
    'substitute:write',
    'substitute:approve',
  ],
  spieler: [
    'member:read',
    'team:read',
    'match:read',
    'training:read',
    'training:write',
    'substitute:read',
    'substitute:write',
  ],
  mitglied: ['member:read', 'team:read', 'match:read'],
};

// === Auth-Fehler ===
export type AuthProblem =
  | 'NO_SESSION'
  | 'NO_USER_ROLES'
  | 'INVALID_ROLE'
  | 'MISSING_MEMBER'
  | 'UNKNOWN';

// === Auth-Modelle ===
export interface AuthUser {
  readonly id: string;
  email: string | null;
  name?: string | null;
  role: AppRole | null;
}

export interface AuthContextValue {
  user: AuthUser | null;
  session: import('@supabase/supabase-js').Session | null;
  role: AppRole | null;
  member: Tables<'members'> | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  problem: AuthProblem | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

export interface GuardResult {
  allowed: boolean;
  reason: 'OK' | AuthProblem | 'ROLE_DENIED';
}
