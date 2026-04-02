import { hasPermission } from '@/lib/permissions';
import type { AppRole, Permission } from '@/types/auth';
import type { SettingsAccessContext, SettingsSubpageDef } from './types';

export function canAccessSettingsPage(
  page: Pick<SettingsSubpageDef, 'requiredPermission'>,
  ctx: SettingsAccessContext,
): boolean {
  if (!page.requiredPermission) return true;
  return hasPermission(ctx.role as AppRole | null | undefined, page.requiredPermission);
}

export function canWriteSettingsPage(
  page: Pick<SettingsSubpageDef, 'requiredPermission' | 'writePermission'>,
  ctx: SettingsAccessContext,
): boolean {
  const required = (page.writePermission ?? page.requiredPermission) as Permission | undefined;
  if (!required) return true;
  return hasPermission(ctx.role as AppRole | null | undefined, required);
}
