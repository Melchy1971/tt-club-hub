import { Badge } from '@/components/ui/badge';
import type { MatchStatusValue } from '@/schemas/match.schema';

const CONFIG: Record<
  MatchStatusValue,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  geplant:    { label: 'Geplant',     variant: 'outline' },
  laufend:    { label: 'Laufend',     variant: 'default' },
  beendet:    { label: 'Beendet',     variant: 'secondary' },
  verschoben: { label: 'Verschoben',  variant: 'outline' },
  abgesagt:   { label: 'Abgesagt',    variant: 'destructive' },
};

interface Props {
  status: MatchStatusValue;
}

export function MatchStatusBadge({ status }: Props) {
  const cfg = CONFIG[status] ?? { label: status, variant: 'outline' as const };
  return (
    <Badge
      variant={cfg.variant}
      className={
        status === 'laufend'
          ? 'bg-amber-500 text-white hover:bg-amber-600 border-transparent'
          : status === 'beendet'
          ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
          : status === 'verschoben'
          ? 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100'
          : undefined
      }
    >
      {cfg.label}
    </Badge>
  );
}
