import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Download, Upload, AlertTriangle, FileText, X, Play } from 'lucide-react';
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

const ALLOWED_RESTORE_TABLES = new Set([
  'members','teams','seasons','season_cycles','season_phases',
  'schedule_matches','venues','news','training_bookings',
  'team_members','team_training_slots','board_members','meetings',
  'documents','communication_lists','communication_list_members',
  'match_availability','match_lineup','substitute_requests',
  'member_roles','club_settings','roles','role_module_permissions',
]);

function parseCsv(text: string): Record<string, unknown>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (field !== '' || cur.length) { cur.push(field); rows.push(cur); cur = []; field = ''; }
        if (c === '\r' && text[i + 1] === '\n') i++;
      } else { field += c; }
    }
  }
  if (field !== '' || cur.length) { cur.push(field); rows.push(cur); }
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((r) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      const v = r[idx];
      // Leere Werte weglassen, damit DB-Defaults (z. B. gen_random_uuid()) greifen
      if (v === undefined || v === '') return;
      obj[h] = v;
    });
    return obj;
  });
}

function detectTableFromFilename(name: string): string | null {
  const m = name.match(/^backup_([a-z_]+)_\d{4}-\d{2}-\d{2}\.csv$/i);
  return m ? m[1] : null;
}

interface PreviewFile {
  file: File;
  table: string | null;
  allowed: boolean;
  rowCount: number;
  sample: Record<string, unknown> | null;
  error?: string;
}

export default function SettingsBackup() {
  const [selected, setSelected] = useState<Set<string>>(new Set(TABLES.map((t) => t.key)));
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [truncateBeforeImport, setTruncateBeforeImport] = useState(false);
  const [previews, setPreviews] = useState<PreviewFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

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
        const { data, error } = await (supabase as any).from(key).select('*');
        if (error || !data?.length) continue;

        const columns: ExportColumn[] = Object.keys(data[0]).map((k) => ({
          key: k,
          label: k,
        }));

        const doc: ExportDocument = {
          title: `Backup – ${key}`,
          filename: `backup_${key}_${new Date().toISOString().split('T')[0]}`,
          generatedAt: new Date().toISOString(),
          sections: [
            {
              type: 'table' as const,
              columns,
              rows: data as Record<string, unknown>[],
            },
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

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (files.length === 0) return;

    const next: PreviewFile[] = [];
    for (const file of files) {
      const table = detectTableFromFilename(file.name);
      const allowed = !!table && ALLOWED_RESTORE_TABLES.has(table);
      try {
        const text = await file.text();
        const rows = parseCsv(text);
        next.push({
          file,
          table,
          allowed,
          rowCount: rows.length,
          sample: rows[0] ?? null,
          error: !allowed ? 'Tabelle nicht erkannt oder nicht erlaubt' : rows.length === 0 ? 'Keine Datensätze' : undefined,
        });
      } catch (err: any) {
        next.push({ file, table, allowed, rowCount: 0, sample: null, error: err?.message ?? 'Lesefehler' });
      }
    }
    setPreviews(next);
  };

  const removePreview = (idx: number) => {
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const runRestore = async () => {
    const valid = previews.filter((p) => p.allowed && p.rowCount > 0);
    if (valid.length === 0) {
      toast.warning('Keine gültigen Dateien zum Einspielen');
      return;
    }
    setImporting(true);
    let totalInserted = 0;
    const errors: string[] = [];
    try {
      for (const p of valid) {
        const { file, table } = p;
        try {
          const text = await file.text();
          const rows = parseCsv(text);
          if (rows.length === 0) {
            errors.push(`${file.name}: keine Datensätze`);
            continue;
          }
          const { data, error } = await (supabase.rpc as any)('admin_restore_table', {
            _table: table,
            _rows: rows,
            _truncate: truncateBeforeImport,
          });
          if (error) {
            errors.push(`${file.name}: ${error.message}`);
          } else {
            totalInserted += Number(data ?? 0);
          }
        } catch (err: any) {
          errors.push(`${file.name}: ${err?.message ?? 'Fehler'}`);
        }
      }
      if (errors.length === 0) {
        toast.success(`Restore abgeschlossen: ${totalInserted} Datensätze eingespielt`);
        setPreviews([]);
      } else {
        toast.error(`Restore mit Fehlern (${totalInserted} eingespielt): ${errors.join(' • ')}`);
      }
      queryClient.invalidateQueries();
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
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

    <Card>
      <CardHeader>
        <CardTitle>Backup wiederherstellen</CardTitle>
        <CardDescription>
          CSV-Backup-Dateien (Format: <code>backup_&lt;tabelle&gt;_YYYY-MM-DD.csv</code>) hochladen und einspielen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
          <div>
            Beim Wiederherstellen werden vorhandene IDs beibehalten. Doppelte Datensätze werden übersprungen.
            Optional kann die Zieltabelle vor dem Einspielen geleert werden – <strong>diese Aktion ist nicht umkehrbar</strong>.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="truncate-before-import"
            checked={truncateBeforeImport}
            onCheckedChange={(v) => setTruncateBeforeImport(v === true)}
          />
          <Label htmlFor="truncate-before-import" className="text-sm">
            Tabelle vor dem Import leeren (überschreiben)
          </Label>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            variant="outline"
          >
            <Upload className="mr-2 h-4 w-4" />
            CSV-Dateien auswählen
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />
          {previews.length > 0 && (
            <Button variant="ghost" onClick={() => setPreviews([])} disabled={importing}>
              Auswahl leeren
            </Button>
          )}
        </div>

        {previews.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Vorschau ({previews.length} Datei{previews.length !== 1 ? 'en' : ''})</p>
            <div className="space-y-2">
              {previews.map((p, idx) => {
                const sampleEntries = p.sample ? Object.entries(p.sample).slice(0, 6) : [];
                return (
                  <div
                    key={`${p.file.name}-${idx}`}
                    className={`rounded-md border p-3 space-y-2 ${p.error ? 'border-destructive/40 bg-destructive/5' : 'border-border'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.table ? <>Tabelle: <code>{p.table}</code></> : 'Tabelle: —'}
                            {' · '}
                            {p.rowCount} Zeile{p.rowCount !== 1 ? 'n' : ''}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removePreview(idx)} disabled={importing}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {p.error && (
                      <p className="text-xs text-destructive">{p.error}</p>
                    )}
                    {sampleEntries.length > 0 && (
                      <div className="rounded bg-muted/50 p-2 text-xs">
                        <p className="mb-1 font-medium text-muted-foreground">Beispielzeile</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                          {sampleEntries.map(([k, v]) => (
                            <div key={k} className="flex gap-2 min-w-0">
                              <span className="text-muted-foreground shrink-0">{k}:</span>
                              <span className="truncate">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                        {p.sample && Object.keys(p.sample).length > sampleEntries.length && (
                          <p className="mt-1 text-muted-foreground">
                            … +{Object.keys(p.sample).length - sampleEntries.length} weitere Spalten
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={runRestore}
                disabled={importing || previews.every((p) => !p.allowed || p.rowCount === 0)}
              >
                <Play className="mr-2 h-4 w-4" />
                {importing ? 'Spiele ein…' : 'Restore starten'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
