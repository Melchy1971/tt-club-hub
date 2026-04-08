import { useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ScheduleMatch, ScheduleMatchUpdate, Venue } from '@/types';

interface Props {
  match: ScheduleMatch;
  venues: Venue[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: ScheduleMatchUpdate) => void;
}

const STATUS_OPTIONS = [
  { value: 'geplant', label: 'Geplant' },
  { value: 'laufend', label: 'Laufend' },
  { value: 'beendet', label: 'Beendet' },
  { value: 'verschoben', label: 'Verschoben' },
  { value: 'abgesagt', label: 'Abgesagt' },
] as const;

/** Convert ISO date to DD.MM.YYYY */
function toGerman(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** Convert DD.MM.YYYY to ISO date */
function toISO(german: string): string | null {
  const parts = german.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!parts) return null;
  return `${parts[3]}-${parts[2]}-${parts[1]}`;
}

export function EditMatchDialog({ match, venues, open, onOpenChange, onSave }: Props) {
  const [date, setDate] = useState(toGerman(match.match_date));
  const [time, setTime] = useState(match.match_time?.slice(0, 5) ?? '');
  const [homeTeam, setHomeTeam] = useState(match.home_team);
  const [awayTeam, setAwayTeam] = useState(match.away_team);
  const [matchDay, setMatchDay] = useState(match.match_day?.toString() ?? '');
  const [isHome, setIsHome] = useState(match.is_home);
  const [venueId, setVenueId] = useState(match.venue_id ?? '');
  const [status, setStatus] = useState(match.status);
  const [pin, setPin] = useState((match as any).pin ?? '');
  const [code, setCode] = useState((match as any).code ?? '');

  const handleSave = () => {
    const isoDate = toISO(date);
    if (!isoDate) return;

    const updates: ScheduleMatchUpdate = {
      match_date: isoDate,
      match_time: time || null,
      home_team: homeTeam,
      away_team: awayTeam,
      match_day: matchDay ? parseInt(matchDay, 10) : null,
      is_home: isHome,
      venue_id: venueId || null,
      status,
      pin: pin || null,
      code: code || null,
    } as any;

    onSave(updates);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Spiel bearbeiten</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Datum (TT.MM.JJJJ)</Label>
              <Input value={date} onChange={(e) => setDate(e.target.value)} placeholder="01.01.2025" />
            </div>
            <div className="space-y-2">
              <Label>Uhrzeit</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Spieltag</Label>
            <Input type="number" min={1} max={34} value={matchDay} onChange={(e) => setMatchDay(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Heimmannschaft</Label>
              <Input value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Gastmannschaft</Label>
              <Input value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={isHome} onCheckedChange={setIsHome} id="is-home" />
            <Label htmlFor="is-home">Heimspiel</Label>
          </div>

          <div className="space-y-2">
            <Label>Spiellokal</Label>
            <Select value={venueId || '__none__'} onValueChange={(v) => setVenueId(v === '__none__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Kein Spiellokal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Kein Spiellokal</SelectItem>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                    {v.city ? ` (${v.city})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pin</Label>
              <Input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Pin eingeben" />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code eingeben" />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
