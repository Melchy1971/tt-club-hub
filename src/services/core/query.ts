import type { ListQuery, SortDirection, SortInput } from './contracts';

export interface NormalizedPagination {
  page: number;
  pageSize: number;
  from: number;
  to: number;
}

export interface NormalizedSort<TField extends string = string> {
  field: TField;
  direction: SortDirection;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;

export function normalizePagination(input?: Pick<ListQuery, 'page' | 'pageSize'>): NormalizedPagination {
  const page = Math.max(DEFAULT_PAGE, Math.floor(input?.page ?? DEFAULT_PAGE));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(input?.pageSize ?? DEFAULT_PAGE_SIZE)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return { page, pageSize, from, to };
}

export function normalizeSort<TField extends string>(
  input: SortInput<TField> | undefined,
  allowedFields: readonly TField[],
  fallbackField: TField,
): NormalizedSort<TField> {
  const field = input?.field && allowedFields.includes(input.field) ? input.field : fallbackField;
  const direction: SortDirection = input?.direction === 'desc' ? 'desc' : 'asc';
  return { field, direction };
}
