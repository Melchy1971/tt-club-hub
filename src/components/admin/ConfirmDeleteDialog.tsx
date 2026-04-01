/**
 * ConfirmDeleteDialog
 *
 * Generischer Lösch-Bestätigungsdialog.
 * Ersetzt den identischen AlertDialog-Block in jeder Admin-Seite.
 *
 * Verwendung:
 *
 * ```tsx
 * <ConfirmDeleteDialog
 *   open={!!crud.deleteId}
 *   onOpenChange={(o) => !o && crud.setDeleteId(null)}
 *   title="Mitglied löschen?"
 *   description="Das Mitglied wird unwiderruflich entfernt."
 *   onConfirm={() => {
 *     mutations.remove(crud.deleteId!);
 *     crud.setDeleteId(null);
 *   }}
 *   isPending={mutations.isDeleting}
 * />
 * ```
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmDeleteDialogProps {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  onConfirm:     () => void;
  title?:        string;
  description?:  string;
  confirmLabel?: string;
  cancelLabel?:  string;
  /** Wenn true: Bestätigungsbutton disabled + ggf. Ladeindikator */
  isPending?:    boolean;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  title        = 'Eintrag löschen?',
  description  = 'Diese Aktion kann nicht rückgängig gemacht werden.',
  confirmLabel = 'Löschen',
  cancelLabel  = 'Abbrechen',
  isPending    = false,
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Wird gelöscht…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
