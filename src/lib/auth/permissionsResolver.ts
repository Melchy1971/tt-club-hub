import type { Tables } from '@/integrations/supabase/types';
import {
  MODULE_KEYS,
  isModuleKey,
  isPermissionLevel,
  type ModuleKey,
  type PermissionLevel,
} from '@/constants/permissionsMatrix';

export type RolePermissionsMap = Record<ModuleKey, PermissionLevel>;

export type RoleWithPermissions = Pick<Tables<'roles'>, 'id' | 'name'> & {
  permissions?: unknown;
  is_system?: boolean;
};

export interface CustomRoleAssignment {
  userId: string;
  roleId: string;
  assignedBy: string | null;
  assignedAt: string;
}

interface CustomRoleAssignmentInput {
  user_id?: unknown;
  role_id?: unknown;
  assigned_by?: unknown;
  created_at?: unknown;
}

const PERMISSION_WEIGHT: Record<PermissionLevel, number> = {
  none: 0,
  read: 1,
  write: 2,
};

export const EMPTY_ROLE_PERMISSIONS: RolePermissionsMap = MODULE_KEYS.reduce((acc, moduleKey) => {
  acc[moduleKey] = 'none';
  return acc;
}, {} as RolePermissionsMap);

export const isPermissionLevelValue = (value: string): value is PermissionLevel =>
  isPermissionLevel(value);

export const normalizeRolePermissions = (permissions: unknown): RolePermissionsMap => {
  const normalized: RolePermissionsMap = { ...EMPTY_ROLE_PERMISSIONS };

  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    return normalized;
  }

  for (const [moduleKey, level] of Object.entries(permissions as Record<string, unknown>)) {
    if (!isModuleKey(moduleKey) || typeof level !== 'string' || !isPermissionLevelValue(level)) {
      continue;
    }

    normalized[moduleKey] = level;
  }

  return normalized;
};

export const validateRolePermissionsPayload = (
  payload: Record<string, unknown>,
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  for (const [moduleKey, level] of Object.entries(payload)) {
    if (!isModuleKey(moduleKey)) {
      errors.push(`Unbekanntes Modul: ${moduleKey}`);
      continue;
    }

    if (typeof level !== 'string' || !isPermissionLevelValue(level)) {
      errors.push(`Ungültiges Level für ${moduleKey}`);
    }
  }

  return { valid: errors.length === 0, errors };
};

export const assertRoleMutable = (role: RoleWithPermissions): { mutable: boolean; reason?: string } => {
  if (role.is_system) {
    return { mutable: false, reason: 'Systemrollen sind geschützt und können nicht verändert werden.' };
  }

  return { mutable: true };
};

export const normalizeCustomRoleAssignments = (rows: unknown): CustomRoleAssignment[] => {
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((row) => {
    const candidate = row as CustomRoleAssignmentInput;
    if (typeof candidate.user_id !== 'string' || typeof candidate.role_id !== 'string') {
      return [];
    }

    return [{
      userId: candidate.user_id,
      roleId: candidate.role_id,
      assignedBy: typeof candidate.assigned_by === 'string' ? candidate.assigned_by : null,
      assignedAt: typeof candidate.created_at === 'string' ? candidate.created_at : '',
    }];
  });
};

export const resolveEffectivePermissions = (...sources: Array<RolePermissionsMap | null | undefined>): RolePermissionsMap => {
  const resolved: RolePermissionsMap = { ...EMPTY_ROLE_PERMISSIONS };

  for (const source of sources) {
    if (!source) continue;

    for (const moduleKey of MODULE_KEYS) {
      const current = resolved[moduleKey];
      const candidate = source[moduleKey] ?? 'none';

      if (PERMISSION_WEIGHT[candidate] > PERMISSION_WEIGHT[current]) {
        resolved[moduleKey] = candidate;
      }
    }
  }

  return resolved;
};

export const resolveRolePermissions = (role: RoleWithPermissions): RolePermissionsMap =>
  normalizeRolePermissions(role.permissions);
