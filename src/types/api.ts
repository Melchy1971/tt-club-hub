// === Branded ID-Typen (verhindert Verwechslung verschiedener IDs) ===
type Brand<T, B extends string> = T & { readonly __brand: B };

export type MemberId = Brand<string, 'MemberId'>;
export type TeamId = Brand<string, 'TeamId'>;
export type MatchId = Brand<string, 'MatchId'>;
export type SeasonId = Brand<string, 'SeasonId'>;

// Hilfsfunktion zum Casten einer rohen string-ID
export const asMemberId = (id: string): MemberId => id as MemberId;
export const asTeamId = (id: string): TeamId => id as TeamId;
export const asMatchId = (id: string): MatchId => id as MatchId;
export const asSeasonId = (id: string): SeasonId => id as SeasonId;

// === Fehler-Typen ===
export type AppErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR';

export interface AppError {
  code: AppErrorCode;
  message: string;
  details?: unknown;
}

// === Result-Typ (Discriminated Union) ===
export type Ok<T> = { readonly success: true; readonly data: T };
export type Err<E = AppError> = { readonly success: false; readonly error: E };
export type ApiResult<T, E = AppError> = Ok<T> | Err<E>;

// === Pagination ===
export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export type PaginatedResult<T> = ApiResult<PaginatedData<T>>;
