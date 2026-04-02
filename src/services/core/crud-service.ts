import { tryCatch } from '@/lib/api';
import { fromSupabaseError, errors, getErrorMessage } from '@/lib/error';
import type { ApiResult, AppError, PaginatedData } from '@/types/api';
import type { DomainMapper, ListQuery, ServiceContract } from './contracts';
import { normalizePagination, normalizeSort } from './query';

const toAppError = (error: unknown): AppError => {
  if (error != null && typeof error === 'object' && 'code' in error && 'message' in error) {
    return error as AppError;
  }
  return errors.internal(getErrorMessage(error));
};

interface CrudFactoryOptions<TDbRow, TDomainModel, TViewModel, TCreateInput, TUpdateInput, TFilter, TSortField extends string> {
  selectPage: (query: ListQuery<TFilter, TSortField>, page: ReturnType<typeof normalizePagination>, sort: ReturnType<typeof normalizeSort<TSortField>>) => Promise<{ rows: TDbRow[]; total: number }>;
  selectById: (id: string) => Promise<TDbRow | null>;
  insertOne: (input: TCreateInput) => Promise<TDbRow>;
  updateOne: (id: string, input: TUpdateInput) => Promise<TDbRow>;
  deleteOne: (id: string) => Promise<void>;
  mapper: DomainMapper<TDbRow, TDomainModel, TViewModel>;
  allowedSortFields: readonly TSortField[];
  fallbackSortField: TSortField;
}

export function createCrudService<
  TDbRow,
  TDomainModel,
  TViewModel,
  TCreateInput,
  TUpdateInput,
  TFilter = Record<string, unknown>,
  TSortField extends string = string,
>(options: CrudFactoryOptions<TDbRow, TDomainModel, TViewModel, TCreateInput, TUpdateInput, TFilter, TSortField>): ServiceContract<TViewModel, TCreateInput, TUpdateInput, TFilter, TSortField> {
  return {
    async list(query = {}): Promise<ApiResult<PaginatedData<TViewModel>>> {
      return tryCatch(async () => {
        const pagination = normalizePagination(query);
        const sort = normalizeSort(query.sort, options.allowedSortFields, options.fallbackSortField);
        const { rows, total } = await options.selectPage(query, pagination, sort);
        const items = rows
          .map(options.mapper.dbToDomain)
          .map(options.mapper.domainToView);

        return {
          items,
          total,
          page: pagination.page,
          pageSize: pagination.pageSize,
          hasMore: pagination.page * pagination.pageSize < total,
        };
      }, toAppError);
    },

    async getById(id: string): Promise<ApiResult<TViewModel | null>> {
      return tryCatch(async () => {
        const row = await options.selectById(id);
        if (!row) return null;
        return options.mapper.domainToView(options.mapper.dbToDomain(row));
      }, toAppError);
    },

    async create(input: TCreateInput): Promise<ApiResult<TViewModel>> {
      return tryCatch(async () => {
        const row = await options.insertOne(input);
        return options.mapper.domainToView(options.mapper.dbToDomain(row));
      }, (error) => fromSupabaseError(error));
    },

    async update(id: string, input: TUpdateInput): Promise<ApiResult<TViewModel>> {
      return tryCatch(async () => {
        const row = await options.updateOne(id, input);
        return options.mapper.domainToView(options.mapper.dbToDomain(row));
      }, (error) => fromSupabaseError(error));
    },

    async remove(id: string): Promise<ApiResult<void>> {
      return tryCatch(async () => {
        await options.deleteOne(id);
      }, (error) => fromSupabaseError(error));
    },
  };
}
