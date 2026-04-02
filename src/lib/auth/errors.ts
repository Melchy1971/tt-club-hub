import type { AuthProblem } from '@/types/auth';

export class AuthResolutionError extends Error {
  readonly code: AuthProblem;

  constructor(code: AuthProblem, message: string) {
    super(message);
    this.name = 'AuthResolutionError';
    this.code = code;
  }
}

export class NoSessionError extends AuthResolutionError {
  constructor() {
    super('NO_SESSION', 'Es ist keine aktive Session vorhanden.');
    this.name = 'NoSessionError';
  }
}

export class MissingMemberProfileError extends AuthResolutionError {
  constructor() {
    super('MISSING_MEMBER', 'Zur Session wurde kein Member-Profil gefunden.');
    this.name = 'MissingMemberProfileError';
  }
}

export class MissingUserRolesError extends AuthResolutionError {
  constructor() {
    super('NO_USER_ROLES', 'Zur Session wurden keine user_roles gefunden.');
    this.name = 'MissingUserRolesError';
  }
}

export class InconsistentAuthDataError extends AuthResolutionError {
  constructor() {
    super('INCONSISTENT_DATA', 'Es liegen inkonsistente Auth-Daten für den User vor.');
    this.name = 'InconsistentAuthDataError';
  }
}

export const toAuthError = (problem: AuthProblem): AuthResolutionError => {
  switch (problem) {
    case 'NO_SESSION':
      return new NoSessionError();
    case 'MISSING_MEMBER':
      return new MissingMemberProfileError();
    case 'NO_USER_ROLES':
      return new MissingUserRolesError();
    case 'INCONSISTENT_DATA':
      return new InconsistentAuthDataError();
    case 'INVALID_ROLE':
      return new AuthResolutionError('INVALID_ROLE', 'Die user_roles enthalten ungültige Rollenwerte.');
    case 'UNKNOWN':
    default:
      return new AuthResolutionError('UNKNOWN', 'Unbekannter Fehler bei der Auth-Auflösung.');
  }
};
