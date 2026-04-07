import { ROUTES } from '@/routes/navigation';
import { SETTINGS_SUBPAGES } from '@/settings/subpages';
import { canAccessSettingsPage } from '@/settings/access';
import { NAV_GROUP_LABELS_DE, SETTINGS_GROUP_LABELS_DE } from '@/constants/uiLabels';
import type { NavGroup, RouteConfig } from '@/types/navigation';
import type { SettingsSubpageDef, SettingsSubpageGroup } from '@/settings/types';
import type { NavigationGuardContext } from './guardMapping';
import { isGuardAllowed } from './guardMapping';

export const resolveAllowedRoutes = (ctx: NavigationGuardContext): RouteConfig[] =>
  ROUTES.filter((route) => isGuardAllowed(ctx, route.guard));

export const resolveSidebarGroups = (ctx: NavigationGuardContext): Record<NavGroup, RouteConfig[]> => {
  const groups: Record<NavGroup, RouteConfig[]> = { personal: [], sport: [], club: [], system: [] };
  for (const route of resolveAllowedRoutes(ctx)) {
    if (route.navVisibility !== 'sidebar') continue;
    groups[route.group].push(route);
  }
  return groups;
};

export interface SettingsNavigationGroup {
  key: SettingsSubpageGroup;
  label: string;
  pages: SettingsSubpageDef[];
}

export const resolveSettingsNavigation = (
  ctx: Pick<NavigationGuardContext, 'role'>,
): SettingsNavigationGroup[] => {
  const visiblePages = SETTINGS_SUBPAGES.filter((page) => canAccessSettingsPage(page, { role: ctx.role }));

  return (Object.keys(SETTINGS_GROUP_LABELS_DE) as SettingsSubpageGroup[])
    .map((group) => ({
      key: group,
      label: SETTINGS_GROUP_LABELS_DE[group],
      pages: visiblePages.filter((page) => page.group === group),
    }))
    .filter((group) => group.pages.length > 0);
};

export const NAVIGATION_GROUP_LABELS_DE = NAV_GROUP_LABELS_DE;
