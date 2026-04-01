/**
 * useCrudDialog
 *
 * Kapselt den gesamten Dialog-/Formular-Zustand für CRUD-Seiten.
 * Eliminiert ~30 Zeilen identischen Boilerplate pro Admin-Seite.
 *
 * Verwendung:
 *
 * ```tsx
 * const crud = useCrudDialog({
 *   emptyForm,
 *   itemToForm: (s: Season) => ({ name: s.name, ... }),
 * });
 *
 * // Öffnen
 * <Button onClick={crud.openCreate}>Neu</Button>
 * <Button onClick={() => crud.openEdit(item)}>Bearbeiten</Button>
 * <Button onClick={() => crud.setDeleteId(item.id)}>Löschen</Button>
 *
 * // Dialog binden
 * <Dialog open={crud.formOpen} onOpenChange={(o) => !o && crud.closeForm()}>
 *   <Input value={crud.form.name} onChange={(e) => crud.setField('name', e.target.value)} />
 *   {crud.errors.name && <p>{crud.errors.name}</p>}
 *   <Button onClick={() => {
 *     if (!myValidate(crud.form, crud.setErrors)) return;
 *     if (crud.editingItem) updateMut.mutate(...);
 *     else createMut.mutate(...);
 *   }}>Speichern</Button>
 * </Dialog>
 *
 * <ConfirmDeleteDialog
 *   open={!!crud.deleteId}
 *   onOpenChange={(o) => !o && crud.setDeleteId(null)}
 *   onConfirm={() => { deleteMut.mutate(crud.deleteId!); crud.setDeleteId(null); }}
 * />
 * ```
 */

import { useState, useCallback } from 'react';

export interface UseCrudDialogOptions<TItem, TForm> {
  /** Leerer Formularzustand (für "Neu"-Dialog). */
  emptyForm: TForm;
  /**
   * Wandelt eine existierende Entität in einen Formularzustand um.
   * Wird beim Öffnen des Edit-Dialogs aufgerufen.
   */
  itemToForm: (item: TItem) => TForm;
}

export interface UseCrudDialogReturn<TItem, TForm> {
  // ── Dialog-Zustände ────────────────────────────────────────
  formOpen:     boolean;
  editingItem:  TItem | null;
  deleteId:     string | null;

  // ── Formular ───────────────────────────────────────────────
  form:   TForm;
  errors: Record<string, string>;

  // ── Aktionen ───────────────────────────────────────────────
  /** Öffnet den Dialog im "Neu anlegen"-Modus. */
  openCreate: () => void;
  /** Öffnet den Dialog im "Bearbeiten"-Modus und befüllt das Formular. */
  openEdit:   (item: TItem) => void;
  /** Schließt den Dialog und setzt alle Zustände zurück. */
  closeForm:  () => void;
  /** Setzt die ID des zu löschenden Eintrags (öffnet ConfirmDeleteDialog). */
  setDeleteId: (id: string | null) => void;
  /** Setzt ein einzelnes Formularfeld. */
  setField:   <K extends keyof TForm>(key: K, value: TForm[K]) => void;
  /** Setzt Validierungsfehler (aus der validate()-Funktion der Page). */
  setErrors:  (errors: Record<string, string>) => void;
  /** Shortcut: ist dies ein Edit-Vorgang (vs. Create)? */
  isEditing:  boolean;
}

export function useCrudDialog<TItem, TForm>({
  emptyForm,
  itemToForm,
}: UseCrudDialogOptions<TItem, TForm>): UseCrudDialogReturn<TItem, TForm> {
  const [formOpen,    setFormOpen]    = useState(false);
  const [editingItem, setEditingItem] = useState<TItem | null>(null);
  const [deleteId,    setDeleteId]    = useState<string | null>(null);
  const [form,        setForm]        = useState<TForm>(emptyForm);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setForm(emptyForm);
    setErrors({});
    setFormOpen(true);
  }, [emptyForm]);

  const openEdit = useCallback(
    (item: TItem) => {
      setEditingItem(item);
      setForm(itemToForm(item));
      setErrors({});
      setFormOpen(true);
    },
    [itemToForm],
  );

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingItem(null);
    setForm(emptyForm);
    setErrors({});
  }, [emptyForm]);

  const setField = useCallback(<K extends keyof TForm>(key: K, value: TForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  return {
    formOpen,
    editingItem,
    deleteId,
    form,
    errors,
    openCreate,
    openEdit,
    closeForm,
    setDeleteId,
    setField,
    setErrors,
    isEditing: editingItem !== null,
  };
}
