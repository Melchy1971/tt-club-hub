import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/routes/navigation';
import { resolveAllowedRoutes, resolveSidebarGroups } from '@/routes/navigationResolver';
import { isGuardAllowed, type NavigationGuardContext } from '@/routes/guardMapping';

export const useNavigationPermissions = () => {
  const { role, roles, isAuthenticated } = useAuth();

  const guardContext = useMemo<NavigationGuardContext>(
    () => ({ role, roles, isAuthenticated }),
    [role, roles, isAuthenticated],
  );

  const allowedRoutes = useMemo(
    () => resolveAllowedRoutes(guardContext),
    [guardContext],
  );

  const byGroup = useMemo(
    () => resolveSidebarGroups(guardContext),
    [guardContext],
  );

  const canAccessPath = (path: string) => {
    const route = ROUTES.find((r) => r.path === path);
    if (!route) return false;
    return isGuardAllowed(guardContext, route.guard);
  };

  const canAccessModule = (moduleKey: string) => {
    const route = ROUTES.find((r) => r.moduleKey === moduleKey);
    if (!route) return false;
    return isGuardAllowed(guardContext, route.guard);
  };

  return { role, allowedRoutes, navGroups: byGroup, canAccessPath, canAccessModule };
};
