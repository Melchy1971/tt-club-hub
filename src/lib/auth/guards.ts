import type { AppRole, AuthContextValue, GuardResult } from '@/types/auth';
import { hasPermission, type PermissionDomain } from '@/lib/permissions';
import type { Permission } from '@/types/auth';

export const hasRole = (
  currentRole: AppRole | null | undefined,
  required: AppRole | AppRole[] | undefined
): boolean => {
  if (!required) return true;
  if (!currentRole) return false;
  const list = Array.isArray(required) ? required : [required];
  return list.includes(currentRole);
};

export const canRead = (role: AppRole | null | undefined, domain: PermissionDomain): boolean =>
  hasPermission(role, `${domain}:read` as Permission);

export const canWrite = (role: AppRole | null | undefined, domain: PermissionDomain): boolean =>
  hasPermission(role, `${domain}:write` as Permission);

export const evaluateGuard = (
  auth: Pick<AuthContextValue, 'isAuthenticated' | 'role' | 'problem'>,
  required?: AppRole | AppRole[]
): GuardResult => {
  if (!auth.isAuthenticated) {
    return { allowed: false, reason: auth.problem ?? 'NO_SESSION' };
  }

  if (!hasRole(auth.role, required)) {
    return { allowed: false, reason: 'ROLE_DENIED' };
  }

  return { allowed: true, reason: 'OK' };
};

// Component-level helper: throws if not allowed (use inside loaders/actions)
export const assertAuthorized = (
  auth: Pick<AuthContextValue, 'isAuthenticated' | 'role' | 'problem'>,
  required?: AppRole | AppRole[]
): void => {
  const result = evaluateGuard(auth, required);
  if (!result.allowed) {
    const error = new Error(`Authorization failed: ${result.reason}`);
    (error as any).code = result.reason;
    throw error;
  }
};
