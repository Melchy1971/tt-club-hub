import { describe, expect, it } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { resolvePrimaryRole, resolveRolesFromAssignments, resolveSessionState } from '@/lib/auth/resolver';
import {
  assertAuthorized,
  canRead,
  canWrite,
  evaluateGuard,
  hasAnyRole,
  hasRole,
  isAdminOrBoard,
} from '@/lib/auth/guards';
import { MissingMemberProfileError, MissingUserRolesError } from '@/lib/auth/errors';

const createSession = (userId = 'user-1'): Session =>
  ({
    access_token: 'token',
    refresh_token: 'refresh',
    expires_in: 3600,
    expires_at: 9999999999,
    token_type: 'bearer',
    user: {
      id: userId,
      app_metadata: {},
      user_metadata: { full_name: 'Max Mustermann' },
      aud: 'authenticated',
      created_at: '2026-04-01T00:00:00.000Z',
      email: 'max@example.com',
    },
  } as Session);

describe('auth resolver', () => {
  it('löst Rollen aus user_roles auf und dedupliziert', () => {
    const roles = resolveRolesFromAssignments('user-1', [
      { user_id: 'user-1', role: 'spieler' },
      { user_id: 'user-1', role: 'spieler' },
      { user_id: 'user-1', role: 'trainer' },
      { user_id: 'user-2', role: 'admin' },
    ]);

    expect(roles).toEqual(['spieler', 'trainer']);
    expect(resolvePrimaryRole(roles)).toBe('trainer');
  });

  it('liefert Fehlerfall: Session ohne Member', () => {
    const result = resolveSessionState({
      session: createSession(),
      userRoles: [{ user_id: 'user-1', role: 'spieler' }],
      member: null,
    });

    expect(result.isAuthenticated).toBe(false);
    expect(result.problems).toContain('MISSING_MEMBER');
  });

  it('liefert Fehlerfall: Session ohne Rollen', () => {
    const result = resolveSessionState({
      session: createSession(),
      userRoles: [],
      member: { user_id: 'user-1' } as never,
    });

    expect(result.isAuthenticated).toBe(false);
    expect(result.problems).toContain('NO_USER_ROLES');
  });

  it('liefert Fehlerfall: inkonsistente Daten', () => {
    const result = resolveSessionState({
      session: createSession('user-1'),
      userRoles: [{ user_id: 'other-user', role: 'admin' }],
      member: { user_id: 'other-user' } as never,
    });

    expect(result.isAuthenticated).toBe(false);
    expect(result.problems).toContain('INCONSISTENT_DATA');
  });
});

describe('guard utilities', () => {
  it('prüft hasRole für einzelne und mehrere Rollen', () => {
    expect(hasRole('admin', 'admin')).toBe(true);
    expect(hasRole('spieler', ['admin', 'trainer'])).toBe(false);
  });

  it('prüft hasAnyRole und isAdminOrBoard', () => {
    expect(hasAnyRole(['spieler', 'trainer'], ['admin', 'trainer'])).toBe(true);
    expect(isAdminOrBoard(['vorstand'])).toBe(true);
    expect(isAdminOrBoard(['spieler'])).toBe(false);
  });

  it('prüft canRead/canWrite Utilities', () => {
    expect(canRead('mitglied', 'match')).toBe(true);
    expect(canWrite('mitglied', 'match')).toBe(false);
    expect(canWrite('trainer', 'training')).toBe(true);
  });

  it('bewertet Guard auf Routenebene', () => {
    const denied = evaluateGuard({ isAuthenticated: false, roles: [], problem: 'NO_SESSION' }, ['admin']);
    const allowed = evaluateGuard({ isAuthenticated: true, roles: ['admin'], problem: null }, ['admin']);

    expect(denied.allowed).toBe(false);
    expect(allowed.allowed).toBe(true);
  });

  it('wirft spezialisierte Fehler für Component-Guards', () => {
    expect(() =>
      assertAuthorized({ isAuthenticated: false, roles: [], problem: 'MISSING_MEMBER' }, ['admin'])
    ).toThrow(MissingMemberProfileError);

    expect(() =>
      assertAuthorized({ isAuthenticated: false, roles: [], problem: 'NO_USER_ROLES' }, ['admin'])
    ).toThrow(MissingUserRolesError);
  });
});
