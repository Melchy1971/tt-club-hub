import { getErrorMessage } from './error';
import type { ApiResult, AppError, Err, Ok } from '@/types/api';

// === Result-Konstruktoren ===

export const ok = <T>(data: T): Ok<T> => ({ success: true, data });
export const err = <E = AppError>(error: E): Err<E> => ({ success: false, error });

// === Result-Guards ===

export function isOk<T>(result: ApiResult<T>): result is Ok<T> {
  return result.success === true;
}

export function isErr<T>(result: ApiResult<T>): result is Err<AppError> {
  return result.success === false;
}

// === Result-Helfer ===

/** Gibt den Wert zurück oder wirft einen Fehler. Nur für Fälle verwenden, wo ein Fehler unmöglich ist. */
export function unwrap<T>(result: ApiResult<T>): T {
  if (isOk(result)) return result.data;
  throw new Error(result.error.message);
}

/** Gibt den Wert zurück oder den Fallback-Wert bei Fehler. */
export function unwrapOr<T>(result: ApiResult<T>, fallback: T): T {
  return isOk(result) ? result.data : fallback;
}

/** Transformiert den Wert eines Ok-Results (wie Array.map). */
export function mapResult<T, U>(result: ApiResult<T>, fn: (data: T) => U): ApiResult<U> {
  return isOk(result) ? ok(fn(result.data)) : result;
}

// === Async-Wrapper ===

/**
 * Führt eine async-Funktion aus und normalisiert Fehler zu ApiResult.
 * Verhindert try/catch-Boilerplate in Services.
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  onError?: (e: unknown) => AppError,
): Promise<ApiResult<T>> {
  try {
    const data = await fn();
    return ok(data);
  } catch (e) {
    if (onError) return err(onError(e));
    return err({ code: 'INTERNAL_ERROR', message: getErrorMessage(e) } satisfies AppError);
  }
}
