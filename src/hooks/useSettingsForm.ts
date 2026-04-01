/**
 * useSettingsForm
 *
 * Standardisierter Hook für alle Settings-Formulare.
 * Kapselt:
 *   - react-hook-form + zodResolver
 *   - Remote-Daten laden und Formular befüllen (useEffect + reset)
 *   - Dirty-State: `isDirty` ist true sobald Werte vom letzten Speicherstand abweichen
 *   - Speichern via useMutation + toast-Feedback + Query-Invalidierung
 *   - Cancel: setzt auf zuletzt geladene/gespeicherte Werte zurück
 *
 * Eliminiert den identischen Boilerplate in SettingsClub.tsx und SettingsProfile.tsx
 * (und allen künftigen Settings-Komponenten).
 *
 * Verwendung (Beispiel: Vereinsdaten):
 *
 * ```tsx
 * const { form, isDirty, isSaving, save, cancel } = useSettingsForm({
 *   queryKey:      ['club-settings'],
 *   queryFn:       () => supabase.from('club_settings').select('*').limit(1).maybeSingle()
 *                          .then(({ data, error }) => { if (error) throw error; return data; }),
 *   schema:        clubSchema,
 *   defaultValues: { club_name: '', ... },
 *   dataToForm:    (d) => ({ club_name: d.club_name ?? '', ... }),
 *   saveFn:        async (values) => { ... },
 *   messages:      { success: 'Vereinsdaten gespeichert' },
 * });
 *
 * return (
 *   <SettingsSection title="Vereinsdaten">
 *     <Form {...form}>
 *       <form onSubmit={save} className="space-y-4">
 *         {/* Felder */}
 *         <SettingsSaveBar isDirty={isDirty} isSaving={isSaving} onSave={save} onCancel={cancel} />
 *       </form>
 *     </Form>
 *   </SettingsSection>
 * );
 * ```
 */

import { useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { FieldValues } from 'react-hook-form';
import type { UseSettingsFormOptions, UseSettingsFormReturn } from '@/types/settings';

export function useSettingsForm<TForm extends FieldValues, TData = unknown>({
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

  // ── 1. Daten laden ─────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn,
  });

  // ── 2. Formular initialisieren ─────────────────────────────

  const form = useForm<TForm>({
    resolver: zodResolver(schema),
    defaultValues,
    // mode 'onChange' sorgt dafür, dass isDirty sofort nach Änderung aktuell ist
    mode: 'onChange',
  });

  // Speichert die zuletzt bekannten Server-Werte für cancel()
  const lastServerValues = useRef<TForm>(defaultValues);

  // ── 3. Formular befüllen wenn Daten ankommen ───────────────

  useEffect(() => {
    if (data != null) {
      const formValues = dataToForm(data as NonNullable<TData>);
      lastServerValues.current = formValues;
      form.reset(formValues);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // ── 4. Speichern ───────────────────────────────────────────

  const saveMut = useMutation({
    mutationFn: saveFn,
    onSuccess: () => {
      toast.success(messages.success ?? 'Einstellungen gespeichert');
      // Nach dem Speichern neu laden → useEffect befüllt Formular → isDirty = false
      queryClient.invalidateQueries({ queryKey });
      onSaved?.();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Fehler beim Speichern';
      toast.error(messages.error ?? msg);
    },
  });

  // ── 5. Dirty-State ─────────────────────────────────────────
  //
  // react-hook-form's `formState.isDirty` vergleicht gegen `defaultValues`,
  // nicht gegen den zuletzt gespeicherten Stand. Wir nutzen form.reset() nach
  // dem Laden (s. o.), was `defaultValues` im Formular-State aktualisiert.
  // Damit spiegelt `isDirty` korrekt "hat der Nutzer seit dem letzten Laden
  // oder Speichern etwas geändert?" wider.
  const { isDirty } = form.formState;

  // ── 6. Öffentliche Aktionen ────────────────────────────────

  const save = useCallback(() => {
    form.handleSubmit((values) => saveMut.mutate(values))();
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
