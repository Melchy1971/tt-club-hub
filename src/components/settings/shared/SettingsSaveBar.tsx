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
