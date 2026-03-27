import type { AppError, AppErrorCode } from '@/types/api';

// === Fehler erstellen ===

export function createError(code: AppErrorCode, message: string, details?: unknown): AppError {
  return { code, message, details };
}

export const errors = {
  notFound: (entity: string, id?: string): AppError =>
    createError(
      'NOT_FOUND',
      id ? `${entity} mit ID "${id}" nicht gefunden` : `${entity} nicht gefunden`,
    ),

  unauthorized: (): AppError => createError('UNAUTHORIZED', 'Nicht authentifiziert'),

  forbidden: (action?: string): AppError =>
    createError(
      'FORBIDDEN',
      action ? `Keine Berechtigung für: ${action}` : 'Zugriff verweigert',
    ),

  validation: (message: string, details?: unknown): AppError =>
    createError('VALIDATION_ERROR', message, details),

  conflict: (message: string): AppError => createError('CONFLICT', message),

  internal: (message = 'Ein interner Fehler ist aufgetreten', details?: unknown): AppError =>
    createError('INTERNAL_ERROR', message, details),

  network: (message = 'Netzwerkfehler — bitte Verbindung prüfen', details?: unknown): AppError =>
    createError('NETWORK_ERROR', message, details),
};

// === Supabase-Fehler normalisieren ===

export function fromSupabaseError(error: { message: string; code?: string }): AppError {
  switch (error.code) {
    case 'PGRST116':
      return errors.notFound('Datensatz');
    case '23505':
      return errors.conflict('Datensatz existiert bereits (doppelter Eintrag)');
    case '42501':
      return errors.forbidden();
    case '23503':
      return errors.validation('Referenzierter Datensatz existiert nicht');
    default:
      return errors.internal(error.message, error);
  }
}

// === Fehlermeldung aus unbekanntem Fehler extrahieren ===

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error != null && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unbekannter Fehler';
}
