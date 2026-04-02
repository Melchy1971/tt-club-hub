import { hasPermission } from '@/lib/permissions';
import { canRead, canWrite, resolveModulePermissions } from '@/lib/auth/permissionsResolver';
import type { AuthContextValue } from '@/types/auth';
import type { RouteGuard } from '@/types/navigation';

export interface NavigationGuardContext {
  role: AuthContextValue['role'];
  roles: AuthContextValue['roles'];
  isAuthenticated: boolean;
}

const checkModuleAccess = (
  ctx: NavigationGuardContext,
  module: RouteGuard & { type: 'module' },
): boolean => {
  const modulePermissions = resolveModulePermissions({ appRole: ctx.role });
  if (module.level === 'WRITE') {
    return canWrite(modulePermissions, module.module);
  }
  return canRead(modulePermissions, module.module);
};

export const GUARD_MAPPING = {
  public: () => true,
  authenticated: (ctx: NavigationGuardContext) => ctx.isAuthenticated,
  permission: (ctx: NavigationGuardContext, guard: Extract<RouteGuard, { type: 'permission' }>) =>
    hasPermission(ctx.role, guard.permission),
  roles: (ctx: NavigationGuardContext, guard: Extract<RouteGuard, { type: 'roles' }>) =>
    guard.roles.some((role) => ctx.roles.includes(role)),
  module: (ctx: NavigationGuardContext, guard: Extract<RouteGuard, { type: 'module' }>) =>
    checkModuleAccess(ctx, guard),
} as const;

export const isGuardAllowed = (ctx: NavigationGuardContext, guard: RouteGuard): boolean => {
  switch (guard.type) {
    case 'public':
      return GUARD_MAPPING.public();
    case 'authenticated':
      return GUARD_MAPPING.authenticated(ctx);
    case 'permission':
      return GUARD_MAPPING.permission(ctx, guard);
    case 'roles':
      return GUARD_MAPPING.roles(ctx, guard);
    case 'module':
      return GUARD_MAPPING.module(ctx, guard);
    default:
      return false;
  }
};
