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
