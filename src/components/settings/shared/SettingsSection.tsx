/**
 * SettingsSection
 *
 * Standardisiertes Card-Layout für einen Abschnitt innerhalb einer Settings-Seite.
 * Ersetzt das direkte `<Card>` + `<CardHeader>` + `<CardContent>`-Muster
 * in allen Settings-Komponenten.
 *
 * Varianten:
 *   'default' → normaler Card-Rahmen
 *   'danger'  → destructive-farbener Rahmen + roter Titel (für Gefahrenzone-Sections)
 *
 * Verwendung:
 *
 * ```tsx
 * // Einfacher Informationsbereich
 * <SettingsSection title="Aktive Sitzung" description="Sitzungs-Details">
 *   <div>...</div>
 * </SettingsSection>
 *
 * // Formular-Bereich mit Save-Bar
 * <SettingsSection title="Vereinsdaten" description="Stammdaten des Vereins">
 *   <Form {...form}>
 *     <form onSubmit={save}>
 *       {/* Felder */}
 *       <SettingsSaveBar isDirty={isDirty} isSaving={isSaving} onSave={save} onCancel={cancel} />
 *     </form>
 *   </Form>
 * </SettingsSection>
 *
 * // Gefahrenzone
 * <SettingsSection title="Gefahrenzone" variant="danger" description="Irreversible Aktionen">
 *   ...
 * </SettingsSection>
 * ```
 */

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { SettingsSectionProps } from '@/types/settings';

export function SettingsSection({
  title,
  description,
  children,
  variant = 'default',
  className,
}: SettingsSectionProps) {
  const isDanger = variant === 'danger';

  return (
    <Card
      className={cn(
        isDanger && 'border-destructive/50',
        className,
      )}
    >
      <CardHeader>
        <CardTitle
          className={cn(
            isDanger && 'text-destructive flex items-center gap-2',
          )}
        >
          {title}
        </CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
