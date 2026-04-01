/**
 * SettingsSaveBar
 *
 * Save/Cancel-Leiste, die sichtbar wird sobald ein Settings-Formular
 * ungespeicherte Änderungen hat (isDirty = true).
 *
 * Verhalten:
 *   - Versteckt wenn isDirty = false (kein Layout-Shift durch height:0 + overflow:hidden)
 *   - Animiert ein/aus (transition auf max-height + opacity)
 *   - Zeigt "Nicht gespeicherte Änderungen" als Hinweis
 *   - Cancel: setzt Formular zurück (via cancel() aus useSettingsForm)
 *   - Save: speichert (via save() aus useSettingsForm)
 *   - Buttons disabled während isPending
 *
 * Platzierung: Am Ende des `<form>`-Elements, direkt vor `</form>`.
 *
 * ```tsx
 * <form onSubmit={save} className="space-y-4">
 *   {/* Formularfelder */}
 *   <SettingsSaveBar
 *     isDirty={isDirty}
 *     isSaving={isSaving}
 *     onSave={save}
 *     onCancel={cancel}
 *   />
 * </form>
 * ```
 *
 * Alternativ als eigenständige Komponente ohne <form>:
 * ```tsx
 * <SettingsSaveBar
 *   isDirty={isDirty}
 *   isSaving={isSaving}
 *   onSave={() => form.handleSubmit(saveFn)()}
 *   onCancel={() => form.reset(lastValues)}
 * />
 * ```
 */

import { Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SettingsSaveBarProps } from '@/types/settings';

export function SettingsSaveBar({
  isDirty,
  isSaving,
  onSave,
  onCancel,
}: SettingsSaveBarProps) {
  return (
    <div
      className={cn(
        'overflow-hidden transition-all duration-200',
        isDirty ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0 pointer-events-none',
      )}
      aria-hidden={!isDirty}
    >
      <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/50 px-4 py-3 mt-4">
        <p className="text-sm text-muted-foreground">
          Nicht gespeicherte Änderungen
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSaving}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Verwerfen
          </Button>
          <Button
            type="submit"
            size="sm"
            onClick={onSave}
            disabled={isSaving}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {isSaving ? 'Speichern…' : 'Speichern'}
          </Button>
        </div>
      </div>
    </div>
  );
}
