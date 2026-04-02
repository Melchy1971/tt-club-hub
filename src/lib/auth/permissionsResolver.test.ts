import { describe, expect, it } from 'vitest';
import {
  EMPTY_ROLE_PERMISSIONS,
  canRead,
  canWrite,
  normalizeRolePermissions,
  resolveModulePermissions,
  validateRolePermissionsPayload,
} from '@/lib/auth/permissionsResolver';

describe('permissionsResolver', () => {
  it('normalisiert unbekannte Module und ungültige Werte auf sichere Fallbacks', () => {
    const normalized = normalizeRolePermissions({
      dashboard: 'READ',
      teams: 'write',
      unknown: 'WRITE',
      import: 123,
    });

    expect(normalized.dashboard).toBe('READ');
    expect(normalized.teams).toBe('WRITE');
    expect(normalized.import).toBe('NONE');
    expect(normalized).toEqual({
      ...EMPTY_ROLE_PERMISSIONS,
      dashboard: 'READ',
      teams: 'WRITE',
    });
  });

  it('validiert Payloads und meldet fehlerhafte Module/Level', () => {
    const result = validateRolePermissionsPayload({
      dashboard: 'READ',
      foo: 'WRITE',
      members: 'INVALID',
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'UNKNOWN_MODULE',
      'INVALID_PERMISSION_LEVEL',
    ]);
  });

  it('löst Konflikte zwischen app_role, system role und custom role mit höchstem Level', () => {
    const effective = resolveModulePermissions({
      appRole: 'mitglied',
      systemRoles: [
        {
          id: 'sys-1',
          name: 'vorstand',
          is_system: true,
          permissions: {
            board: 'READ',
          },
        },
      ],
      customRoles: [
        {
          id: 'c-1',
          name: 'trainer',
          is_system: false,
          permissions: {
            dashboard: 'WRITE',
            board: 'NONE',
          },
        },
      ],
    });

    expect(effective.dashboard).toBe('WRITE');
    expect(effective.board).toBe('READ');
    expect(canRead(effective, 'board')).toBe(true);
    expect(canWrite(effective, 'board')).toBe(false);
  });
});
