import { hasPermission } from '@/lib/permissions';
import type { Permission } from '@/types/auth';
import type { SettingsAccessContext, SettingsSubpageDef } from './types';

export function canAccessSettingsPage(
  page: Pick<SettingsSubpageDef, 'requiredPermission' | 'requiredRole'>,
  ctx: SettingsAccessContext,
): boolean {
  if (page.requiredRole && ctx.role !== page.requiredRole) return false;
  if (!page.requiredPermission) return true;
  return hasPermission(ctx.role, page.requiredPermission);
}

export function canWriteSettingsPage(
  page: Pick<SettingsSubpageDef, 'requiredPermission' | 'writePermission'>,
  ctx: SettingsAccessContext,
): boolean {
  const required = (page.writePermission ?? page.requiredPermission) as Permission | undefined;
  if (!required) return true;
  return hasPermission(ctx.role, required);
}
