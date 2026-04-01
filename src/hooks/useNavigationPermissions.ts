import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { ROUTES } from '@/routes/navigation';
import type { AppRole } from '@/types/auth';
import type { NavGroup, RouteConfig } from '@/types/navigation';

const roleMatch = (role: AppRole | null | undefined, roles?: AppRole[]) =>
  !roles || (role ? roles.includes(role) : false);

const isAllowed = (role: AppRole | null | undefined, route: RouteConfig) => {
  switch (route.guard.type) {
    case 'public':
      return true;
    case 'authenticated':
      return !!role;
    case 'permission':
      return hasPermission(role, route.guard.permission);
    case 'roles':
      return roleMatch(role, route.guard.roles);
    default:
      return false;
  }
};

export const useNavigationPermissions = () => {
  const { role } = useAuth();

  const allowedRoutes = useMemo(
    () => ROUTES.filter((route) => isAllowed(role, route)),
    [role],
  );

  const byGroup = useMemo(() => {
    const groups: Record<NavGroup, RouteConfig[]> = { sport: [], club: [], system: [] };
    for (const route of allowedRoutes) {
      if (!route.hideInSidebar) {
        groups[route.group].push(route);
      }
    }
    return groups;
  }, [allowedRoutes]);

  const canAccessPath = (path: string) => {
    const route = ROUTES.find((r) => r.path === path);
    if (!route) return false;
    return isAllowed(role, route);
  };

  const canAccessModule = (module: string) => {
    const route = ROUTES.find((r) => r.module === module);
    if (!route) return false;
    return isAllowed(role, route);
  };

  return { role, allowedRoutes, navGroups: byGroup, canAccessPath, canAccessModule };
};
