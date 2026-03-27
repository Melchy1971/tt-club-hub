import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { matchResultSchema, MATCH_STATUS_VALUES, type MatchResultInput } from '@/schemas/match.schema';
import type { ScheduleMatch } from '@/types';
import { formatDate } from '@/lib/date';

const STATUS_LABELS: Record<string, string> = {
  geplant: 'Geplant',
  laufend: 'Laufend',
  beendet: 'Beendet',
  verschoben: 'Verschoben',
  abgesagt: 'Abgesagt',
};

interface Props {
  match: ScheduleMatch;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, data: MatchResultInput) => Promise<void>;
  isSaving: boolean;
}

export function EditResultDialog({ match, open, onClose, onSave, isSaving }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<MatchResultInput>({
    resolver: zodResolver(matchResultSchema),
    defaultValues: {
      home_score: match.home_score ?? null,
      away_score: match.away_score ?? null,
      status: match.status as MatchResultInput['status'],
    },
  });

  useEffect(() => {
    reset({
      home_score: match.home_score ?? null,
      away_score: match.away_score ?? null,
      status: match.status as MatchResultInput['status'],
    });
  }, [match, reset]);

  const homeScore = watch('home_score');
  const awayScore = watch('away_score');

  // Wenn beide Scores gesetzt sind und Status noch "geplant" ist → auf "beendet" stellen
  const handleScoreBlur = () => {
    const currentStatus = watch('status');
    if (homeScore != null && awayScore != null && currentStatus === 'geplant') {
      setValue('status', 'beendet');
    }
  };

  const submit = handleSubmit((data) => onSave(match.id, data));

  const matchTitle = `${match.home_team} – ${match.away_team}`;
  const matchDate = formatDate(match.match_date);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ergebnis eintragen</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {matchTitle}
            <br />
            <span className="font-medium">{matchDate}</span>
            {match.match_day != null && (
              <span className="ml-2 text-xs">· Spieltag {match.match_day}</span>
            )}
          </p>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/* Ergebnis */}
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="home_score">{match.home_team}</Label>
              <Input
                id="home_score"
                type="number"
                min={0}
                max={20}
                {...register('home_score', { valueAsNumber: true })}
                onBlur={handleScoreBlur}
                placeholder="–"
                className="text-center text-lg font-bold"
              />
              {errors.home_score && (
                <p className="text-xs text-destructive">{errors.home_score.message}</p>
              )}
            </div>
            <span className="mt-5 text-xl font-bold text-muted-foreground">:</span>
            <div className="flex-1 space-y-1">
              <Label htmlFor="away_score">{match.away_team}</Label>
              <Input
                id="away_score"
                type="number"
                min={0}
                max={20}
                {...register('away_score', { valueAsNumber: true })}
                onBlur={handleScoreBlur}
                placeholder="–"
                className="text-center text-lg font-bold"
              />
              {errors.away_score && (
                <p className="text-xs text-destructive">{errors.away_score.message}</p>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <Label htmlFor="status">Status</Label>
            <Select
              value={watch('status')}
              onValueChange={(v) => setValue('status', v as MatchResultInput['status'])}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATCH_STATUS_VALUES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
