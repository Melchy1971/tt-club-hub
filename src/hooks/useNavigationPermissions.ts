import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { ROUTES, type NavGroup, type RouteConfig } from '@/routes/navigation';
import type { AppRole } from '@/types/auth';

const roleMatch = (role: AppRole | null | undefined, minRoles?: AppRole[]) =>
  !minRoles || (role ? minRoles.includes(role) : false);

const isAllowed = (role: AppRole | null | undefined, route: RouteConfig) => {
  if (route.requiredPermission && hasPermission(role, route.requiredPermission)) return true;
  if (route.minRoles && roleMatch(role, route.minRoles)) return true;
  if (!route.requiredPermission && !route.minRoles) return true;
  return false;
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
