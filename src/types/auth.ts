import type { Enums, Tables } from '@/integrations/supabase/types';
import type { Session } from '@supabase/supabase-js';

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
  | 'board:read'
  | 'board:write'
  | 'board:delete'
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
  'board:read',
  'board:write',
  'board:delete',
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
    'board:read',
    'board:write',
  ],
  trainer: [
    'member:read',
    'team:read',
    'team:write',
    'match:read',
    'match:write',
    'season:read',
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
    'season:read',
    'training:read',
    'training:write',
    'substitute:read',
    'substitute:write',
  ],
  mitglied: ['member:read', 'team:read', 'match:read', 'season:read'],
};

// === Auth-Fehler ===
export type AuthProblem =
  | 'NO_SESSION'
  | 'NO_USER_ROLES'
  | 'INVALID_ROLE'
  | 'MISSING_MEMBER'
  | 'INCONSISTENT_DATA'
  | 'UNKNOWN';

export interface SessionRoleAssignment {
  readonly userId: string;
  readonly role: AppRole;
}

export interface UserCustomRoleAssignment {
  readonly userId: string;
  readonly roleId: string;
  readonly assignedAt: string;
  readonly assignedBy: string | null;
}

export interface AuthSessionState {
  readonly userId: string;
  readonly email: string | null;
  readonly name: string | null;
  readonly roles: readonly AppRole[];
  readonly primaryRole: AppRole | null;
  readonly member: Tables<'members'> | null;
  readonly problems: readonly AuthProblem[];
  readonly isAuthenticated: boolean;
}

export interface AuthSessionModel {
  readonly session: Session;
  readonly user: AuthUser;
  readonly roles: readonly AppRole[];
  readonly primaryRole: AppRole | null;
  readonly member: Tables<'members'> | null;
}

export interface AuthState {
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
  readonly user: AuthUser | null;
  readonly session: Session | null;
  readonly role: AppRole | null;
  readonly roles: readonly AppRole[];
  readonly member: Tables<'members'> | null;
  readonly problem: AuthProblem | null;
  readonly problems: readonly AuthProblem[];
}

// === Auth-Modelle ===
export interface AuthUser {
  readonly id: string;
  email: string | null;
  name?: string | null;
  role: AppRole | null;
}

export interface AuthContextValue {
  user: AuthState['user'];
  session: AuthState['session'];
  role: AuthState['role'];
  roles: AuthState['roles'];
  member: AuthState['member'];
  isLoading: AuthState['isLoading'];
  isAuthenticated: AuthState['isAuthenticated'];
  problem: AuthState['problem'];
  problems: AuthState['problems'];
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

export interface GuardResult {
  allowed: boolean;
  reason: 'OK' | AuthProblem | 'ROLE_DENIED';
}
