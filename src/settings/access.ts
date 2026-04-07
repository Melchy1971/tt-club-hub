import { hasAllPermissions, hasAnyPermission, hasPermission } from '@/lib/permissions';
import type { AppRole, Permission } from '@/types/auth';
import type { SettingsAccessContext, SettingsAccessRule, SettingsSubpageDef } from './types';

function canEvaluateRule(
  rule: SettingsAccessRule | undefined,
  ctx: SettingsAccessContext,
): boolean {
  if (!rule || !rule.permissions || rule.permissions.length === 0) return true;

  const role = ctx.role as AppRole | null | undefined;
  if (rule.permissions.length === 1) {
    return hasPermission(role, rule.permissions[0]);
  }

  return rule.mode === 'all'
    ? hasAllPermissions(role, rule.permissions as Permission[])
    : hasAnyPermission(role, rule.permissions as Permission[]);
}

export function canAccessSettingsPage(
  page: Pick<SettingsSubpageDef, 'readAccess'>,
  ctx: SettingsAccessContext,
): boolean {
  return canEvaluateRule(page.readAccess, ctx);
}

export function canWriteSettingsPage(
  page: Pick<SettingsSubpageDef, 'readAccess' | 'writeAccess'>,
  ctx: SettingsAccessContext,
): boolean {
  return canEvaluateRule(page.writeAccess ?? page.readAccess, ctx);
}
