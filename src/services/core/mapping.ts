export const emptyStringToNull = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const nullToEmptyString = (value: string | null | undefined): string => value ?? '';

export const mapNullable = <TIn, TOut>(
  value: TIn | null | undefined,
  mapper: (input: TIn) => TOut,
): TOut | null => {
  if (value == null) return null;
  return mapper(value);
};

export const mapList = <TIn, TOut>(items: TIn[] | null | undefined, mapper: (input: TIn) => TOut): TOut[] =>
  (items ?? []).map(mapper);
