import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Download, Database } from 'lucide-react';
import { csvAdapter } from '@/lib/export/csvAdapter';
import type { ExportDocument, ExportTableSection, ExportColumn } from '@/lib/export/types';

const TABLES = [
  { key: 'members', label: 'Mitglieder' },
  { key: 'teams', label: 'Mannschaften' },
  { key: 'seasons', label: 'Saisons' },
  { key: 'schedule_matches', label: 'Spielplan' },
  { key: 'venues', label: 'Spiellokale' },
  { key: 'news', label: 'News' },
  { key: 'training_bookings', label: 'Trainingsbuchungen' },
] as const;

export default function SettingsBackup() {
  const [selected, setSelected] = useState<Set<string>>(new Set(TABLES.map((t) => t.key)));
  const [exporting, setExporting] = useState(false);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const exportAll = async () => {
    if (selected.size === 0) return toast.warning('Keine Tabellen ausgewählt');
    setExporting(true);
    try {
      for (const key of selected) {
        const { data, error } = await supabase.from(key as any).select('*');
        if (error || !data?.length) continue;

        const columns: ExportColumn[] = Object.keys(data[0]).map((k) => ({
          key: k,
          label: k,
        }));

        const doc: ExportDocument = {
          title: `Backup – ${key}`,
          generatedAt: new Date().toISOString(),
          sections: [
            {
              type: 'table',
              columns,
              rows: data,
            } as ExportTableSection,
          ],
        };

        const blob = await csvAdapter.render(doc);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${key}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success('Backup-Export abgeschlossen');
    } catch {
      toast.error('Fehler beim Export');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup</CardTitle>
        <CardDescription>Daten als CSV-Dateien exportieren</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {TABLES.map((t) => (
            <div key={t.key} className="flex items-center gap-2">
              <Checkbox
                id={t.key}
                checked={selected.has(t.key)}
                onCheckedChange={() => toggle(t.key)}
              />
              <Label htmlFor={t.key} className="text-sm">{t.label}</Label>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Button onClick={exportAll} disabled={exporting || selected.size === 0}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? 'Exportiere…' : `${selected.size} Tabelle(n) exportieren`}
          </Button>
          <Button
            variant="outline"
            onClick={() => setSelected(selected.size === TABLES.length ? new Set() : new Set(TABLES.map((t) => t.key)))}
          >
            {selected.size === TABLES.length ? 'Keine auswählen' : 'Alle auswählen'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
