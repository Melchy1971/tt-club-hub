import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import type { ScheduleMatch } from '@/types';
import { formatDate } from '@/lib/date';
import type { PinCodeEntry } from '@/schemas/match.schema';

interface Props {
  matches: ScheduleMatch[];
  open: boolean;
  onClose: () => void;
  /** Wird mit allen geänderten Einträgen aufgerufen. */
  onSave: (entries: PinCodeEntry[]) => Promise<void>;
  isSaving: boolean;
}

export function BulkPinCodeDialog({ matches, open, onClose, onSave, isSaving }: Props) {
  const [rows, setRows] = useState<PinCodeEntry[]>(() =>
    matches.map((m) => ({ id: m.id, pin: m.pin ?? null, code: m.code ?? null })),
  );

  // Matches neu laden wenn Dialog öffnet
  const handleOpenChange = (o: boolean) => {
    if (o) {
      setRows(matches.map((m) => ({ id: m.id, pin: m.pin ?? null, code: m.code ?? null })));
    } else {
      onClose();
    }
  };

  const updateRow = (id: string, field: 'pin' | 'code', value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value || null } : r)),
    );
  };

  const handleSave = async () => {
    // Nur geänderte Zeilen mitschicken
    const changed = rows.filter((row) => {
      const original = matches.find((m) => m.id === row.id);
      return original && (original.pin !== row.pin || original.code !== row.code);
    });
    await onSave(changed);
  };

  const matchById = (id: string) => matches.find((m) => m.id === id);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>PIN & Code – Bulk-Bearbeitung</DialogTitle>
          <DialogDescription>
            Zugangscodes für alle Spiele auf einmal eintragen. Nur geänderte Zeilen
            werden gespeichert.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Datum</TableHead>
                <TableHead>Begegnung</TableHead>
                <TableHead className="w-[120px]">PIN</TableHead>
                <TableHead className="w-[140px]">Begegnungscode</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const match = matchById(row.id);
                if (!match) return null;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(match.match_date)}
                      {match.match_day != null && (
                        <span className="ml-1 text-xs">(ST {match.match_day})</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{match.home_team}</span>
                      <span className="text-muted-foreground mx-1">–</span>
                      <span className="text-sm">{match.away_team}</span>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.pin ?? ''}
                        onChange={(e) => updateRow(row.id, 'pin', e.target.value)}
                        placeholder="PIN"
                        className="h-8 font-mono text-sm"
                        maxLength={50}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.code ?? ''}
                        onChange={(e) => updateRow(row.id, 'code', e.target.value)}
                        placeholder="Code"
                        className="h-8 font-mono text-sm"
                        maxLength={50}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {matches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Keine Spiele vorhanden.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Änderungen speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
