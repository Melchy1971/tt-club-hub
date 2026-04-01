import { useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { FieldValues } from 'react-hook-form';
import type { UseSettingsFormOptions, UseSettingsFormReturn } from '@/types/settings';

export function useSettingsForm<TForm extends FieldValues = FieldValues, TData = unknown>({
  queryKey,
  queryFn,
  schema,
  defaultValues,
  dataToForm,
  saveFn,
  messages = {},
  onSaved,
}: UseSettingsFormOptions<TForm, TData>): UseSettingsFormReturn<TForm> {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn,
  });

  const form = useForm<TForm>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as any,
    mode: 'onChange',
  });

  const lastServerValues = useRef<TForm>(defaultValues);

  useEffect(() => {
    if (data != null) {
      const formValues = dataToForm(data as NonNullable<TData>);
      lastServerValues.current = formValues;
      form.reset(formValues);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const saveMut = useMutation({
    mutationFn: saveFn,
    onSuccess: () => {
      toast.success(messages.success ?? 'Einstellungen gespeichert');
      queryClient.invalidateQueries({ queryKey });
      onSaved?.();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Fehler beim Speichern';
      toast.error(messages.error ?? msg);
    },
  });

  const { isDirty } = form.formState;

  const save = useCallback(() => {
    form.handleSubmit((values: any) => saveMut.mutate(values))();
  }, [form, saveMut]);

  const cancel = useCallback(() => {
    form.reset(lastServerValues.current);
  }, [form]);

  return {
    form,
    isLoading,
    isSaving: saveMut.isPending,
    isDirty,
    save,
    cancel,
  };
}
