import type { FieldValues, UseFormReturn } from 'react-hook-form';

function flattenDirtyPaths(value: unknown, prefix = ''): string[] {
  if (value === true) {
    return prefix ? [prefix] : [];
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenDirtyPaths(nested, nextPrefix);
  });
}

export function hasFormErrors<TFieldValues extends FieldValues>(form: UseFormReturn<TFieldValues>): boolean {
  return Object.keys(form.formState.errors).length > 0;
}

export function createDirtyStateSummary<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
): { isDirty: boolean; dirtyFields: string[] } {
  return {
    isDirty: form.formState.isDirty,
    dirtyFields: flattenDirtyPaths(form.formState.dirtyFields),
  };
}

export function mapNullableToEmptyString<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value ?? '']),
  ) as T;
}
