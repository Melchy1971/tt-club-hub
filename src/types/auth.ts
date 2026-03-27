// === Rollen ===
export const APP_ROLES = [
  'admin',
  'vorstand',
  'trainer',
  'spieler',
  'mitglied',
  'developer',
] as const;

export type AppRole = (typeof APP_ROLES)[number];

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

// === Auth-User ===
export interface AuthUser {
  readonly id: string;
  email: string;
  name: string;
  role: AppRole;
}
