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
import type { ScheduleMatch } from '@/types';

interface Props {
  match: ScheduleMatch;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (homeScore: number, awayScore: number) => void;
}

export function EditResultDialog({ match, open, onOpenChange, onSave }: Props) {
  const [homeScore, setHomeScore] = useState(match.home_score?.toString() ?? '');
  const [awayScore, setAwayScore] = useState(match.away_score?.toString() ?? '');

  const handleSave = () => {
    const h = parseInt(homeScore, 10);
    const a = parseInt(awayScore, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return;
    onSave(h, a);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ergebnis eintragen</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">
          {match.home_team} – {match.away_team}
        </p>
        <div className="flex items-end gap-4">
          <div className="flex-1 space-y-2">
            <Label>Heim</Label>
            <Input
              type="number"
              min={0}
              max={9}
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              className="text-center text-2xl font-mono"
            />
          </div>
          <span className="pb-2 text-2xl font-bold text-muted-foreground">:</span>
          <div className="flex-1 space-y-2">
            <Label>Gast</Label>
            <Input
              type="number"
              min={0}
              max={9}
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              className="text-center text-2xl font-mono"
            />
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
