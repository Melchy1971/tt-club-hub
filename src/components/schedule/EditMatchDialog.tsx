import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { MATCH_STATUS_VALUES } from '@/schemas/match.schema';
import type { ScheduleMatch } from '@/types';

const STATUS_LABELS: Record<string, string> = {
  geplant: 'Geplant',
  laufend: 'Laufend',
  beendet: 'Beendet',
  verschoben: 'Verschoben',
  abgesagt: 'Abgesagt',
};

// Formular-Schema (nur editierbare Felder)
const editMatchFormSchema = z.object({
  match_day: z.number().int().min(1).max(99).nullable().optional(),
  match_date: z.string().date('Ungültiges Datum'),
  match_time: z
    .string()
    .regex(/^(\d{2}:\d{2}(:\d{2})?)?$/, 'Format HH:MM')
    .nullable()
    .optional()
    .transform((v) => v || null),
  home_team: z.string().trim().min(1, 'Pflichtfeld').max(100),
  away_team: z.string().trim().min(1, 'Pflichtfeld').max(100),
  is_home: z.boolean(),
  status: z.enum(MATCH_STATUS_VALUES),
  pin: z.string().trim().max(50).nullable().optional().transform((v) => v || null),
  code: z.string().trim().max(50).nullable().optional().transform((v) => v || null),
  report_text: z
    .string()
    .max(2000)
    .nullable()
    .optional()
    .transform((v) => v || null),
});

export type EditMatchFormData = z.infer<typeof editMatchFormSchema>;

interface Props {
  match: ScheduleMatch;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, data: EditMatchFormData) => Promise<void>;
  isSaving: boolean;
}

export function EditMatchDialog({ match, open, onClose, onSave, isSaving }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<EditMatchFormData>({
    resolver: zodResolver(editMatchFormSchema),
    defaultValues: {
      match_day: match.match_day ?? undefined,
      match_date: match.match_date,
      match_time: match.match_time ? match.match_time.slice(0, 5) : null,
      home_team: match.home_team,
      away_team: match.away_team,
      is_home: match.is_home,
      status: match.status as EditMatchFormData['status'],
      pin: match.pin ?? null,
      code: match.code ?? null,
      report_text: match.report_text ?? null,
    },
  });

  useEffect(() => {
    reset({
      match_day: match.match_day ?? undefined,
      match_date: match.match_date,
      match_time: match.match_time ? match.match_time.slice(0, 5) : null,
      home_team: match.home_team,
      away_team: match.away_team,
      is_home: match.is_home,
      status: match.status as EditMatchFormData['status'],
      pin: match.pin ?? null,
      code: match.code ?? null,
      report_text: match.report_text ?? null,
    });
  }, [match, reset]);

  const submit = handleSubmit((data) => onSave(match.id, data));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Spiel bearbeiten</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/* Spieltag + Datum + Zeit */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="match_day">Spieltag</Label>
              <Input
                id="match_day"
                type="number"
                min={1}
                max={99}
                {...register('match_day', { valueAsNumber: true })}
                placeholder="–"
              />
              {errors.match_day && (
                <p className="text-xs text-destructive">{errors.match_day.message}</p>
              )}
            </div>
            <div className="space-y-1 col-span-2">
              <Label htmlFor="match_date">Datum</Label>
              <Input id="match_date" type="date" {...register('match_date')} />
              {errors.match_date && (
                <p className="text-xs text-destructive">{errors.match_date.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="match_time">Uhrzeit</Label>
              <Input id="match_time" type="time" {...register('match_time')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="status">Status</Label>
              <Select
                value={watch('status')}
                onValueChange={(v) => setValue('status', v as EditMatchFormData['status'])}
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
          </div>

          {/* Mannschaften */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="home_team">Heimmannschaft</Label>
              <Input id="home_team" {...register('home_team')} />
              {errors.home_team && (
                <p className="text-xs text-destructive">{errors.home_team.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="away_team">Gastmannschaft</Label>
              <Input id="away_team" {...register('away_team')} />
              {errors.away_team && (
                <p className="text-xs text-destructive">{errors.away_team.message}</p>
              )}
            </div>
          </div>

          {/* Heimspiel-Toggle */}
          <div className="flex items-center gap-3 rounded-md border px-3 py-2">
            <Switch
              id="is_home"
              checked={watch('is_home')}
              onCheckedChange={(v) => setValue('is_home', v)}
            />
            <Label htmlFor="is_home" className="cursor-pointer">
              Heimspiel
            </Label>
          </div>

          {/* PIN + Code */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="pin">PIN</Label>
              <Input
                id="pin"
                {...register('pin')}
                placeholder="z.B. 12345"
                className="font-mono"
              />
              {errors.pin && (
                <p className="text-xs text-destructive">{errors.pin.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="code">Begegnungscode</Label>
              <Input
                id="code"
                {...register('code')}
                placeholder="z.B. 12345678"
                className="font-mono"
              />
              {errors.code && (
                <p className="text-xs text-destructive">{errors.code.message}</p>
              )}
            </div>
          </div>

          {/* Bemerkungen */}
          <div className="space-y-1">
            <Label htmlFor="report_text">Bemerkungen</Label>
            <Textarea
              id="report_text"
              {...register('report_text')}
              rows={3}
              placeholder="Spielbericht, Notizen …"
            />
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
