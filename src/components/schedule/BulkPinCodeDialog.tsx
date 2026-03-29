import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ScheduleMatch } from '@/types';

interface Props {
  matches: ScheduleMatch[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: { id: string; pin: string | null; code: string | null }[]) => void;
}

function formatGermanDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function BulkPinCodeDialog({ matches, open, onOpenChange, onSave }: Props) {
  const [entries, setEntries] = useState<Map<string, { pin: string; code: string }>>(new Map());

  useEffect(() => {
    const map = new Map<string, { pin: string; code: string }>();
    matches.forEach((m) => {
      map.set(m.id, {
        pin: (m as any).pin ?? '',
        code: (m as any).code ?? '',
      });
    });
    setEntries(map);
  }, [matches]);

  const update = (id: string, field: 'pin' | 'code', value: string) => {
    setEntries((prev) => {
      const next = new Map(prev);
      const entry = next.get(id) ?? { pin: '', code: '' };
      next.set(id, { ...entry, [field]: value });
      return next;
    });
  };

  const handleSave = () => {
    const updates = Array.from(entries.entries()).map(([id, { pin, code }]) => ({
      id,
      pin: pin || null,
      code: code || null,
    }));
    onSave(updates);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pins & Codes bearbeiten</DialogTitle>
        </DialogHeader>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ST</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Begegnung</TableHead>
                <TableHead>Pin</TableHead>
                <TableHead>Code</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((match) => {
                const entry = entries.get(match.id) ?? { pin: '', code: '' };
                return (
                  <TableRow key={match.id}>
                    <TableCell className="font-mono text-muted-foreground">
                      {match.match_day ?? '–'}
                    </TableCell>
                    <TableCell>{formatGermanDate(match.match_date)}</TableCell>
                    <TableCell className="text-sm">
                      {match.home_team} – {match.away_team}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={entry.pin}
                        onChange={(e) => update(match.id, 'pin', e.target.value)}
                        className="h-8 w-24 font-mono text-xs"
                        placeholder="Pin"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={entry.code}
                        onChange={(e) => update(match.id, 'code', e.target.value)}
                        className="h-8 w-24 font-mono text-xs"
                        placeholder="Code"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave}>Alle speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
