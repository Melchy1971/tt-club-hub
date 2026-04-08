import { ROLE_PERMISSIONS } from '@/types/auth';
import type { AppRole, Permission } from '@/types/auth';

// === Kern-Prüfungen ===

export function hasPermission(
  role: AppRole | null | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role];
  if (perms.includes('admin:all')) return true;
  return perms.includes(permission);
}

export function hasAnyPermission(
  role: AppRole | null | undefined,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(
  role: AppRole | null | undefined,
  permissions: Permission[],
): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

// === Rollen-Shortcuts ===

export const isAdmin = (role: AppRole | null | undefined): boolean =>
  role === 'admin' || role === 'developer';

export const canManageRoles = (role: AppRole | null | undefined): boolean =>
  role === 'admin' || role === 'developer' || role === 'vorstand';

export const isStaff = (role: AppRole | null | undefined): boolean =>
  role === 'admin' || role === 'developer' || role === 'vorstand' || role === 'trainer';

// === Domain-spezifische Shortcuts ===

export const canReadMembers = (role: AppRole | null | undefined) =>
  hasPermission(role, 'member:read');
export const canWriteMembers = (role: AppRole | null | undefined) =>
  hasPermission(role, 'member:write');
export const canDeleteMembers = (role: AppRole | null | undefined) =>
  hasPermission(role, 'member:delete');

export const canReadTeams = (role: AppRole | null | undefined) =>
  hasPermission(role, 'team:read');
export const canWriteTeams = (role: AppRole | null | undefined) =>
  hasPermission(role, 'team:write');

export const canReadMatches = (role: AppRole | null | undefined) =>
  hasPermission(role, 'match:read');
export const canWriteMatches = (role: AppRole | null | undefined) =>
  hasPermission(role, 'match:write');

export const canApproveSubstitutes = (role: AppRole | null | undefined) =>
  hasPermission(role, 'substitute:approve');

export const canAccessSettings = (role: AppRole | null | undefined) =>
  hasPermission(role, 'settings:read');

// === Typsichere Permission-Modelle ===
export type PermissionDomain =
  | 'member'
  | 'team'
  | 'match'
  | 'season'
  | 'training'
  | 'substitute'
  | 'settings'
  | 'admin';

export type PermissionAction =
  | 'read'
  | 'write'
  | 'delete'
  | 'approve'
  | 'all';

export type PermissionKey = `${PermissionDomain}:${PermissionAction}`;

export interface RolePolicy {
  allow: PermissionKey[];
  deny?: PermissionKey[];
  inherits?: AppRole[];
}

export type RolePolicyMap = Record<string, RolePolicy>;

const dedupe = (arr: PermissionKey[]) => Array.from(new Set(arr));

/**
 * Resolves effective permissions from:
 * - app_role baseline (ROLE_PERMISSIONS)
 * - custom roles (policies) identified by string ids
 * Deny beats allow. Inherit merges other app_roles.
 */
export const resolvePermissions = (
  appRole: AppRole | null | undefined,
  customRoleIds: string[] = [],
  customPolicies: RolePolicyMap = {},
): PermissionKey[] => {
  const allow: PermissionKey[] = [];
  const deny: Set<PermissionKey> = new Set();

  // baseline from app_role
  if (appRole) {
    allow.push(...(ROLE_PERMISSIONS[appRole] as PermissionKey[]));
  }

  for (const roleId of customRoleIds) {
    const policy = customPolicies[roleId];
    if (!policy) continue;
    if (policy.inherits) {
      policy.inherits.forEach((r) => allow.push(...(ROLE_PERMISSIONS[r] as PermissionKey[])));
    }
    allow.push(...policy.allow);
    (policy.deny ?? []).forEach((p) => deny.add(p));
  }

  const effective = dedupe(allow).filter((p) => !deny.has(p));
  return effective;
};

export const canRead = (
  permissions: PermissionKey[],
  domain: PermissionDomain,
): boolean => permissions.includes(`${domain}:read`) || permissions.includes('admin:all' as PermissionKey);

export const canWrite = (
  permissions: PermissionKey[],
  domain: PermissionDomain,
): boolean =>
  permissions.includes(`${domain}:write`) ||
  permissions.includes(`${domain}:all`) ||
  permissions.includes('admin:all' as PermissionKey);

export const canDelete = (
  permissions: PermissionKey[],
  domain: PermissionDomain,
): boolean =>
  permissions.includes(`${domain}:delete`) ||
  permissions.includes(`${domain}:all`) ||
  permissions.includes('admin:all' as PermissionKey);

export const canApprove = (
  permissions: PermissionKey[],
  domain: PermissionDomain = 'substitute',
): boolean =>
  permissions.includes(`${domain}:approve`) ||
  permissions.includes(`${domain}:all`) ||
  permissions.includes('admin:all' as PermissionKey);

export const canWriteSeasons = (role: AppRole | null | undefined) =>
  hasPermission(role, 'season:write');
export const canDeleteSeasons = (role: AppRole | null | undefined) =>
  hasPermission(role, 'season:delete');

// Vorstandsbereich
export const canReadBoard = (role: AppRole | null | undefined) =>
  hasPermission(role, 'board:read');
export const canWriteBoard = (role: AppRole | null | undefined) =>
  hasPermission(role, 'board:write');
export const canDeleteBoard = (role: AppRole | null | undefined) =>
  hasPermission(role, 'board:delete');
