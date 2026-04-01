/**
 * useCrudMutations
 *
 * Kapselt die drei Standard-Mutations (create, update, delete) inklusive
 * Toast-Feedback und Query-Invalidierung.
 *
 * Eliminiert ~30 Zeilen identischen Boilerplate pro Admin-Seite.
 *
 * Kompatibel mit beiden Service-Mustern im Projekt:
 *   - throw-basiert (memberService, seasonService) → Fehler landen in onError
 *   - ApiResult-basiert (documentService, boardMeetingService) →
 *     Wrapper in mutationFn nötig (siehe Beispiel unten)
 *
 * Verwendung (throw-basierter Service):
 *
 * ```tsx
 * const mutations = useCrudMutations({
 *   queryKey: ['seasons'],
 *   createFn: (data: SeasonInsert) => seasonService.create(data),
 *   updateFn: ({ id, data }) => seasonService.update(id, data),
 *   deleteFn: (id: string) => seasonService.remove(id),
 *   messages: { created: 'Saison erstellt', updated: 'Saison aktualisiert', deleted: 'Saison gelöscht' },
 *   onSuccess: {
 *     create: () => { crud.closeForm(); refreshSeason(); },
 *     update: () => { crud.closeForm(); refreshSeason(); },
 *   },
 * });
 *
 * // Im JSX
 * <Button
 *   onClick={() => {
 *     if (!validate()) return;
 *     if (crud.editingItem) {
 *       mutations.update({ id: crud.editingItem.id, data: formToPayload(crud.form) });
 *     } else {
 *       mutations.create(formToPayload(crud.form));
 *     }
 *   }}
 *   disabled={mutations.isPending}
 * >
 *   {crud.isEditing ? 'Speichern' : 'Erstellen'}
 * </Button>
 * ```
 *
 * Verwendung (ApiResult-basierter Service):
 *
 * ```tsx
 * const mutations = useCrudMutations({
 *   queryKey: ['board_meetings'],
 *   createFn: async (data) => {
 *     const result = await boardMeetingService.create(data);
 *     if (!result.success) throw new Error(result.error.message);
 *     return result.data;
 *   },
 *   ...
 * });
 * ```
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ── Typen ──────────────────────────────────────────────────────

export interface CrudMessages {
  created?: string;
  updated?: string;
  deleted?: string;
}

export interface CrudMutationsOptions<TCreate, TUpdate, TResult> {
  /**
   * QueryKey (oder Teil davon) der zu invalidierenden Abfragen nach jeder Mutation.
   * Wird als `{ queryKey }` an `invalidateQueries` übergeben.
   */
  queryKey: unknown[];

  /** Service-Funktion zum Erstellen. */
  createFn: (data: TCreate) => Promise<TResult>;

  /** Service-Funktion zum Aktualisieren. */
  updateFn: (args: { id: string; data: TUpdate }) => Promise<TResult>;

  /** Service-Funktion zum Löschen. */
  deleteFn: (id: string) => Promise<void | unknown>;

  /** Toast-Meldungen bei Erfolg. Defaults: "Erstellt" / "Aktualisiert" / "Gelöscht". */
  messages?: CrudMessages;

  /**
   * Optionale Callbacks, die NACH der Invalidierung aufgerufen werden.
   * Typische Verwendung: closeForm(), refreshSeason(), etc.
   */
  onSuccess?: {
    create?: (result: TResult) => void;
    update?: (result: TResult) => void;
    delete?: () => void;
  };

  /** Optionale Fehler-Callbacks (zusätzlich zu toast.error). */
  onError?: {
    create?: (error: Error) => void;
    update?: (error: Error) => void;
    delete?: (error: Error) => void;
  };
}

export interface CrudMutationsReturn<TCreate, TUpdate> {
  /** Erstellt einen neuen Eintrag. */
  create:   (data: TCreate) => void;
  /** Aktualisiert einen bestehenden Eintrag. */
  update:   (args: { id: string; data: TUpdate }) => void;
  /** Löscht einen Eintrag anhand seiner ID. */
  remove:   (id: string) => void;

  /** True, wenn irgendeine Mutation läuft (für disabled-Props an Buttons). */
  isPending: boolean;

  // Einzelne pending-Zustände falls benötigt
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

// ── Hook ───────────────────────────────────────────────────────

export function useCrudMutations<TCreate, TUpdate = Partial<TCreate>, TResult = unknown>({
  queryKey,
  createFn,
  updateFn,
  deleteFn,
  messages = {},
  onSuccess = {},
  onError   = {},
}: CrudMutationsOptions<TCreate, TUpdate, TResult>): CrudMutationsReturn<TCreate, TUpdate> {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const normalizeError = (e: unknown): Error =>
    e instanceof Error ? e : new Error(String((e as any)?.message ?? e));

  // ── Create ─────────────────────────────────────────────────

  const createMut = useMutation({
    mutationFn: createFn,
    onSuccess: (result) => {
      toast.success(messages.created ?? 'Erstellt');
      invalidate();
      onSuccess.create?.(result);
    },
    onError: (raw: unknown) => {
      const e = normalizeError(raw);
      toast.error(e.message);
      onError.create?.(e);
    },
  });

  // ── Update ─────────────────────────────────────────────────

  const updateMut = useMutation({
    mutationFn: updateFn,
    onSuccess: (result) => {
      toast.success(messages.updated ?? 'Aktualisiert');
      invalidate();
      onSuccess.update?.(result);
    },
    onError: (raw: unknown) => {
      const e = normalizeError(raw);
      toast.error(e.message);
      onError.update?.(e);
    },
  });

  // ── Delete ─────────────────────────────────────────────────

  const deleteMut = useMutation({
    mutationFn: deleteFn,
    onSuccess: () => {
      toast.success(messages.deleted ?? 'Gelöscht');
      invalidate();
      onSuccess.delete?.();
    },
    onError: (raw: unknown) => {
      const e = normalizeError(raw);
      toast.error(e.message);
      onError.delete?.(e);
    },
  });

  return {
    create:    (data)        => createMut.mutate(data),
    update:    (args)        => updateMut.mutate(args),
    remove:    (id)          => deleteMut.mutate(id),
    isPending: createMut.isPending || updateMut.isPending || deleteMut.isPending,
    isCreating: createMut.isPending,
    isUpdating: updateMut.isPending,
    isDeleting: deleteMut.isPending,
  };
}

// ── Hilfsfunktion: ApiResult → throw-Konvertierung ────────────

/**
 * Wandelt einen ApiResult-basierten Service-Aufruf in einen throw-basierten um.
 * Nützlich für mutationFn, wenn der Service ApiResult<T> zurückgibt.
 *
 * ```tsx
 * createFn: (data) => unwrapResult(boardMeetingService.create(data)),
 * ```
 */
export async function unwrapResult<T>(
  promise: Promise<{ success: true; data: T } | { success: false; error: { message: string } }>,
): Promise<T> {
  const result = await promise;
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}
