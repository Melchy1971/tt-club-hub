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
