import type { AppRole, AuthContextValue, GuardResult } from '@/types/auth';
import { hasPermission, type PermissionDomain } from '@/lib/permissions';
import type { Permission } from '@/types/auth';
import { toAuthError } from '@/lib/auth/errors';

export const hasRole = (
  currentRole: AppRole | readonly AppRole[] | null | undefined,
  required: AppRole | AppRole[] | undefined
): boolean => {
  if (!required) return true;
  if (!currentRole) return false;
  const currentRoles = Array.isArray(currentRole) ? currentRole : [currentRole];
  const list = Array.isArray(required) ? required : [required];
  return list.every((role) => currentRoles.includes(role));
};

export const hasAnyRole = (
  currentRole: AppRole | readonly AppRole[] | null | undefined,
  required: AppRole | AppRole[] | undefined
): boolean => {
  if (!required) return true;
  if (!currentRole) return false;
  const currentRoles = Array.isArray(currentRole) ? currentRole : [currentRole];
  const list = Array.isArray(required) ? required : [required];
  return list.some((role) => currentRoles.includes(role));
};

export const isAdminOrBoard = (currentRole: AppRole | readonly AppRole[] | null | undefined): boolean =>
  hasAnyRole(currentRole, ['admin', 'vorstand']);

export const canRead = (role: AppRole | null | undefined, domain: PermissionDomain): boolean =>
  hasPermission(role, `${domain}:read` as Permission);

export const canWrite = (role: AppRole | null | undefined, domain: PermissionDomain): boolean =>
  hasPermission(role, `${domain}:write` as Permission);

export const evaluateGuard = (
  auth: Pick<AuthContextValue, 'isAuthenticated' | 'roles' | 'problem'>,
  required?: AppRole | AppRole[]
): GuardResult => {
  if (!auth.isAuthenticated) {
    return { allowed: false, reason: auth.problem ?? 'NO_SESSION' };
  }

  if (!hasAnyRole(auth.roles, required)) {
    return { allowed: false, reason: 'ROLE_DENIED' };
  }

  return { allowed: true, reason: 'OK' };
};

export const resolveRouteRedirect = (
  guard: GuardResult,
  fallbackPath = '/',
  authPath = '/auth'
): string | null => {
  if (guard.allowed) return null;
  const authReasons = ['NO_SESSION', 'MISSING_MEMBER', 'NO_USER_ROLES', 'INVALID_ROLE', 'INCONSISTENT_DATA'] as const;
  return (authReasons as readonly string[]).includes(guard.reason) ? authPath : fallbackPath;
};

// Component-level helper: throws if not allowed (use inside loaders/actions)
export const assertAuthorized = (
  auth: Pick<AuthContextValue, 'isAuthenticated' | 'roles' | 'problem'>,
  required?: AppRole | AppRole[]
): void => {
  const result = evaluateGuard(auth, required);
  if (!result.allowed) {
    if (result.reason === 'ROLE_DENIED') {
      const error = new Error('Authorization failed: ROLE_DENIED');
      (error as Error & { code?: string }).code = result.reason;
      throw error;
    }
    throw toAuthError(result.reason as import('@/types/auth').AuthProblem);
  }
};
