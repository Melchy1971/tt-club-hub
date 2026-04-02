import type { Tables } from '@/integrations/supabase/types';
import {
  MODULE_KEYS,
  PERMISSION_LEVELS,
  SYSTEM_APP_ROLE_PERMISSIONS,
  isModuleKey,
  isPermissionLevel,
  type ModuleKey,
  type PermissionLevel,
} from '@/constants/permissionsMatrix';
import type { AppRole } from '@/types/auth';

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
  NONE: 0,
  READ: 1,
  WRITE: 2,
};

const LEGACY_PERMISSION_MAP: Record<string, PermissionLevel> = {
  none: 'NONE',
  read: 'READ',
  write: 'WRITE',
};

export interface PermissionValidationIssue {
  code: 'INVALID_OBJECT' | 'UNKNOWN_MODULE' | 'INVALID_PERMISSION_LEVEL';
  module?: string;
  value?: unknown;
  message: string;
}

export interface PermissionValidationResult {
  valid: boolean;
  errors: string[];
  issues: PermissionValidationIssue[];
}

export const EMPTY_ROLE_PERMISSIONS: RolePermissionsMap = MODULE_KEYS.reduce((acc, moduleKey) => {
  acc[moduleKey] = 'NONE';
  return acc;
}, {} as RolePermissionsMap);

export const isPermissionLevelValue = (value: string): value is PermissionLevel =>
  isPermissionLevel(value) || value.toLowerCase() in LEGACY_PERMISSION_MAP;

const normalizePermissionLevelValue = (value: unknown): PermissionLevel | null => {
  if (typeof value !== 'string') return null;
  if (isPermissionLevel(value)) return value;
  return LEGACY_PERMISSION_MAP[value.toLowerCase()] ?? null;
};

export const normalizeRolePermissions = (permissions: unknown): RolePermissionsMap => {
  const normalized: RolePermissionsMap = { ...EMPTY_ROLE_PERMISSIONS };

  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    return normalized;
  }

  for (const [moduleKey, level] of Object.entries(permissions as Record<string, unknown>)) {
    if (!isModuleKey(moduleKey)) {
      continue;
    }

    const normalizedLevel = normalizePermissionLevelValue(level);
    if (!normalizedLevel) {
      continue;
    }

    normalized[moduleKey] = normalizedLevel;
  }

  return normalized;
};

export const validateRolePermissionsPayload = (
  payload: unknown,
): PermissionValidationResult => {
  const issues: PermissionValidationIssue[] = [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    issues.push({
      code: 'INVALID_OBJECT',
      value: payload,
      message: 'Berechtigungsobjekt muss ein JSON-Objekt sein.',
    });

    return { valid: false, errors: issues.map((issue) => issue.message), issues };
  }

  for (const [moduleKey, level] of Object.entries(payload as Record<string, unknown>)) {
    if (!isModuleKey(moduleKey)) {
      issues.push({
        code: 'UNKNOWN_MODULE',
        module: moduleKey,
        value: level,
        message: `Unbekanntes Modul: ${moduleKey}`,
      });
      continue;
    }

    const normalizedLevel = normalizePermissionLevelValue(level);
    if (!normalizedLevel) {
      issues.push({
        code: 'INVALID_PERMISSION_LEVEL',
        module: moduleKey,
        value: level,
        message: `Ungültiges Level für ${moduleKey}: ${String(level)}`,
      });
    }
  }

  return { valid: issues.length === 0, errors: issues.map((issue) => issue.message), issues };
};

export const assertRoleMutable = (role: RoleWithPermissions): { mutable: boolean; reason?: string } => {
  if (role.is_system) {
    return { mutable: false, reason: 'Systemrollen sind geschützt und können nicht verändert oder gelöscht werden.' };
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
      const candidate = source[moduleKey] ?? 'NONE';

      if (PERMISSION_WEIGHT[candidate] > PERMISSION_WEIGHT[current]) {
        resolved[moduleKey] = candidate;
      }
    }
  }

  return resolved;
};

export interface ResolveModulePermissionsInput {
  appRole: AppRole | null | undefined;
  systemRoles?: Array<RoleWithPermissions | null | undefined>;
  customRoles?: Array<RoleWithPermissions | null | undefined>;
}

/**
 * Konfliktregeln:
 * 1) app_role liefert die Basisrechte.
 * 2) System- und Custom-Rollen werden zusätzlich gemerged.
 * 3) Pro Modul gewinnt immer das höchste Level (NONE < READ < WRITE).
 */
export const resolveModulePermissions = ({
  appRole,
  systemRoles = [],
  customRoles = [],
}: ResolveModulePermissionsInput): RolePermissionsMap => {
  const baseline = appRole ? SYSTEM_APP_ROLE_PERMISSIONS[appRole] : EMPTY_ROLE_PERMISSIONS;

  const roleMaps = [...systemRoles, ...customRoles].map((role) =>
    role ? normalizeRolePermissions(role.permissions) : EMPTY_ROLE_PERMISSIONS
  );

  return resolveEffectivePermissions(baseline, ...roleMaps);
};

export const canRead = (permissions: RolePermissionsMap, moduleKey: ModuleKey): boolean =>
  permissions[moduleKey] === 'READ' || permissions[moduleKey] === 'WRITE';

export const canWrite = (permissions: RolePermissionsMap, moduleKey: ModuleKey): boolean =>
  permissions[moduleKey] === 'WRITE';

export const resolveRolePermissions = (role: RoleWithPermissions): RolePermissionsMap =>
  normalizeRolePermissions(role.permissions);

export const getPermissionLevelLabelsDe: Record<PermissionLevel, string> = {
  NONE: 'Keine',
  READ: 'Lesen',
  WRITE: 'Schreiben',
};

export const getAllowedPermissionLevels = (): readonly PermissionLevel[] => PERMISSION_LEVELS;
