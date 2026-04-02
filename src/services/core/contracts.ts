import type { ApiResult, PaginatedData } from '@/types/api';

export type SortDirection = 'asc' | 'desc';

export interface SortInput<TField extends string = string> {
  field?: TField;
  direction?: SortDirection;
}

export interface ListQuery<TFilter = Record<string, unknown>, TSortField extends string = string> {
  page?: number;
  pageSize?: number;
  sort?: SortInput<TSortField>;
  filter?: TFilter;
}

export interface ServiceContract<
  TViewModel,
  TCreateInput,
  TUpdateInput,
  TFilter = Record<string, unknown>,
  TSortField extends string = string,
> {
  list(query?: ListQuery<TFilter, TSortField>): Promise<ApiResult<PaginatedData<TViewModel>>>;
  getById(id: string): Promise<ApiResult<TViewModel | null>>;
  create(input: TCreateInput): Promise<ApiResult<TViewModel>>;
  update(id: string, input: TUpdateInput): Promise<ApiResult<TViewModel>>;
  remove(id: string): Promise<ApiResult<void>>;
}

export interface DomainMapper<TDbRow, TDomainModel, TViewModel> {
  dbToDomain(row: TDbRow): TDomainModel;
  domainToView(model: TDomainModel): TViewModel;
}
