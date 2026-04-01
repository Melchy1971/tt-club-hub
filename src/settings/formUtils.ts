import type { FieldValues, UseFormReturn } from 'react-hook-form';

export function hasFormErrors<TFieldValues extends FieldValues>(form: UseFormReturn<TFieldValues>): boolean {
  return Object.keys(form.formState.errors).length > 0;
}

export function createDirtyStateSummary<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
): { isDirty: boolean; dirtyFields: string[] } {
  const dirtyEntries = Object.entries(form.formState.dirtyFields)
    .filter(([, isDirty]) => Boolean(isDirty))
    .map(([key]) => key);

  return {
    isDirty: form.formState.isDirty,
    dirtyFields: dirtyEntries,
  };
}

export function mapNullableToEmptyString<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value ?? '']),
  ) as T;
}
