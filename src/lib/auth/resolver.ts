import type { Session, User } from '@supabase/supabase-js';
import type { AppRole, AuthProblem, AuthSessionState, AuthUser } from '@/types/auth';
import { APP_ROLES } from '@/types/auth';
import type { Tables } from '@/integrations/supabase/types';

const ROLE_PRIORITY: AppRole[] = ['developer', 'admin', 'vorstand', 'trainer', 'spieler', 'mitglied', 'fördermitglied'];

type UserRoleRow = Pick<Tables<'user_roles'>, 'user_id' | 'role'>;

const pushProblem = (problems: AuthProblem[], problem: AuthProblem) => {
  if (!problems.includes(problem)) {
    problems.push(problem);
  }
};

export const isValidRole = (role: string | null | undefined): role is AppRole =>
  !!role && APP_ROLES.includes(role as AppRole);

export const resolveRolesFromAssignments = (
  userId: string,
  assignments: UserRoleRow[] | null | undefined,
): AppRole[] => {
  const resolved = (assignments ?? [])
    .filter((assignment) => assignment.user_id === userId)
    .map((assignment) => assignment.role)
    .filter(isValidRole);

  return Array.from(new Set(resolved));
};

export const resolvePrimaryRole = (roles: readonly AppRole[]): AppRole | null => {
  for (const candidate of ROLE_PRIORITY) {
    if (roles.includes(candidate)) return candidate;
  }

  return null;
};

const resolveDisplayName = (user: User): string | null =>
  user.user_metadata?.full_name ??
  ([user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(' ') || null);

export const resolveAuthUser = (user: User, primaryRole: AppRole | null): AuthUser => ({
  id: user.id,
  email: user.email ?? null,
  name: resolveDisplayName(user),
  role: primaryRole,
});

export const resolveSessionState = ({
  session,
  userRoles,
  member,
  roleError,
  memberError,
}: {
  session: Session | null;
  userRoles: UserRoleRow[] | null | undefined;
  member: Tables<'members'> | null;
  roleError?: boolean;
  memberError?: boolean;
}): AuthSessionState => {
  if (!session?.user) {
    return {
      userId: '',
      email: null,
      name: null,
      roles: [],
      primaryRole: null,
      member: null,
      problems: ['NO_SESSION'],
      isAuthenticated: false,
    };
  }

  const user = session.user;
  const problems: AuthProblem[] = [];

  if (roleError || memberError) {
    pushProblem(problems, 'UNKNOWN');
  }

  const hasForeignAssignments = (userRoles ?? []).some((entry) => entry.user_id !== user.id);
  if (hasForeignAssignments) {
    pushProblem(problems, 'INCONSISTENT_DATA');
  }

  const roles = resolveRolesFromAssignments(user.id, userRoles);
  if (!userRoles?.length) {
    pushProblem(problems, 'NO_USER_ROLES');
  }

  if (userRoles?.length && roles.length === 0) {
    pushProblem(problems, 'INVALID_ROLE');
  }

  const primaryRole = resolvePrimaryRole(roles);

  if (!member) {
    pushProblem(problems, 'MISSING_MEMBER');
  } else if (member.user_id !== user.id) {
    pushProblem(problems, 'INCONSISTENT_DATA');
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    name: resolveDisplayName(user),
    roles,
    primaryRole,
    member,
    problems,
    isAuthenticated: problems.length === 0,
  };
};
