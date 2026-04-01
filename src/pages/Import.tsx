import { useState, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Upload, FileText, AlertCircle, CheckCircle2, Download, TableProperties, KeyRound, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

// ─── Shared helpers ────────────────────────────────────────────────────────────

function parseFileToRows(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv' || ext === 'txt') {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: (r) => resolve(r.data),
        error: (e) => reject(e),
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
          resolve(rows);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    } else {
      reject(new Error('Nicht unterstütztes Dateiformat'));
    }
  });
}

function parseDate(val: string): string | null {
  if (!val) return null;
  const de = val.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (de) return `${de[3]}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  return null;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

interface FileDropZoneProps {
  onFile: (f: File) => void;
  accept?: string;
  hint?: string;
}

function FileDropZone({ onFile, accept = '.csv,.xlsx,.xls', hint }: FileDropZoneProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={cn(
        'border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors',
        dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
      )}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      onClick={() => ref.current?.click()}
    >
      <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
      <p className="text-sm font-medium">Datei hierher ziehen oder klicken</p>
      <p className="text-xs text-muted-foreground mt-1">{hint ?? `Unterstützt: CSV, Excel (.xlsx, .xls)`}</p>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: Mitglieder-Import
// ═══════════════════════════════════════════════════════════════════════════════

interface CsvCol { key: string; label: string; required?: boolean }

const MEMBER_COLS: CsvCol[] = [
  { key: 'first_name', label: 'Vorname', required: true },
  { key: 'last_name', label: 'Nachname', required: true },
  { key: 'email', label: 'E-Mail' },
  { key: 'phone', label: 'Telefon' },
  { key: 'date_of_birth', label: 'Geburtsdatum' },
  { key: 'gender', label: 'Geschlecht' },
  { key: 'street', label: 'Straße' },
  { key: 'zip_code', label: 'PLZ' },
  { key: 'city', label: 'Ort' },
  { key: 'member_number', label: 'Mitgliedsnr.' },
  { key: 'entry_date', label: 'Eintrittsdatum' },
  { key: 'exit_date', label: 'Austrittsdatum' },
  { key: 'ttr_rating', label: 'TTR' },
  { key: 'qttr_rating', label: 'QTTR' },
  { key: 'age_group', label: 'Altersgruppe' },
  { key: 'notes', label: 'Notizen' },
];

const HEADER_ALIASES: Record<string, string> = {
  vorname: 'first_name', nachname: 'last_name', name: 'last_name',
  e_mail: 'email', mail: 'email', telefon: 'phone', tel: 'phone',
  geburtsdatum: 'date_of_birth', geb_datum: 'date_of_birth',
  geschlecht: 'gender', straße: 'street', strasse: 'street',
  plz: 'zip_code', postleitzahl: 'zip_code', ort: 'city', stadt: 'city',
  mitgliedsnr: 'member_number', mitgliedsnummer: 'member_number', nr: 'member_number',
  eintrittsdatum: 'entry_date', eintritt: 'entry_date',
  austrittsdatum: 'exit_date', austritt: 'exit_date',
  ttr: 'ttr_rating', qttr: 'qttr_rating',
  altersgruppe: 'age_group', altersklasse: 'age_group',
  notizen: 'notes', bemerkung: 'notes', bemerkungen: 'notes',
};

const GENDER_MAP: Record<string, string> = {
  m: 'maennlich', männlich: 'maennlich', maennlich: 'maennlich', male: 'maennlich',
  w: 'weiblich', weiblich: 'weiblich', female: 'weiblich',
  d: 'divers', divers: 'divers',
};

const VALID_AGE_GROUPS = [
  'herren', 'damen', 'jungen_18', 'maedchen_18', 'jungen_15', 'maedchen_15',
  'jungen_13', 'maedchen_13', 'jungen_11', 'maedchen_11', 'senioren', 'seniorinnen',
];

type MemberStep = 'upload' | 'mapping' | 'preview' | 'done';

interface RowValidation {
  data: Record<string, any>;
  errors: string[];
  warnings: string[];
  isDuplicate?: boolean;
  existingMemberId?: string;
}

function normalizeKey(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9äöüß]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function autoMap(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const dbKeys = MEMBER_COLS.map((c) => c.key);
  const used = new Set<string>();
  headers.forEach((h) => {
    const norm = normalizeKey(h);
    if (dbKeys.includes(norm) && !used.has(norm)) { mapping[h] = norm; used.add(norm); return; }
    const alias = HEADER_ALIASES[norm];
    if (alias && !used.has(alias)) { mapping[h] = alias; used.add(alias); }
  });
  return mapping;
}

function validateMemberRow(raw: Record<string, string>): RowValidation {
  const errs: string[] = [];
  const warns: string[] = [];
  const data: Record<string, any> = {};

  if (!raw.first_name?.trim()) errs.push('Vorname fehlt');
  if (!raw.last_name?.trim()) errs.push('Nachname fehlt');

  data.first_name = raw.first_name?.trim() || '';
  data.last_name = raw.last_name?.trim() || '';
  data.email = raw.email?.trim() || null;
  data.phone = raw.phone?.trim() || null;
  data.street = raw.street?.trim() || null;
  data.zip_code = raw.zip_code?.trim() || null;
  data.city = raw.city?.trim() || null;
  data.member_number = raw.member_number?.trim() || null;
  data.notes = raw.notes?.trim() || null;

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) warns.push('Ungültige E-Mail');

  if (raw.date_of_birth?.trim()) {
    const d = parseDate(raw.date_of_birth.trim());
    if (!d) warns.push('Ungültiges Geburtsdatum');
    data.date_of_birth = d;
  } else data.date_of_birth = null;

  data.entry_date = parseDate(raw.entry_date?.trim() || '') || new Date().toISOString().slice(0, 10);
  data.exit_date = parseDate(raw.exit_date?.trim() || '') || null;

  if (raw.gender?.trim()) {
    const g = GENDER_MAP[raw.gender.trim().toLowerCase()];
    if (g) data.gender = g;
    else { warns.push(`Unbekanntes Geschlecht: "${raw.gender}"`); data.gender = null; }
  } else data.gender = null;

  for (const key of ['ttr_rating', 'qttr_rating'] as const) {
    if (raw[key]?.trim()) {
      const n = parseInt(raw[key].trim(), 10);
      if (isNaN(n) || n < 0 || n > 3500) { warns.push(`Ungültiger ${key === 'ttr_rating' ? 'TTR' : 'QTTR'}-Wert`); data[key] = null; }
      else data[key] = n;
    } else data[key] = null;
  }

  if (raw.age_group?.trim()) {
    const ag = raw.age_group.trim().toLowerCase();
    if (VALID_AGE_GROUPS.includes(ag)) data.age_group = ag;
    else { warns.push(`Unbekannte Altersgruppe`); data.age_group = null; }
  } else data.age_group = null;

  data.is_active = true;
  return { data, errors: errs, warnings: warns };
}

function MemberImportTab() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<MemberStep>('upload');
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validated, setValidated] = useState<RowValidation[]>([]);
  const [fileName, setFileName] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [dupMode, setDupMode] = useState<'skip' | 'update'>('skip');

  const handleFile = useCallback(async (file: File) => {
    try {
      setFileName(file.name);
      const rows = await parseFileToRows(file);
      if (rows.length === 0) { toast.error('Leere Datei'); return; }
      const hdrs = Object.keys(rows[0]);
      setHeaders(hdrs);
      setRawRows(rows);
      setMapping(autoMap(hdrs));
      setStep('mapping');
    } catch {
      toast.error('Fehler beim Lesen der Datei');
    }
  }, []);

  const proceedToPreview = async () => {
    const mapped = new Set(Object.values(mapping));
    const missing = MEMBER_COLS.filter((c) => c.required && !mapped.has(c.key));
    if (missing.length > 0) {
      toast.error(`Pflichtfelder nicht zugeordnet: ${missing.map((c) => c.label).join(', ')}`);
      return;
    }

    setIsChecking(true);
    const existingByEmail = new Map<string, string>();
    const existingByMN = new Map<string, string>();
    try {
      const { data: existing } = await supabase.from('members').select('id, email, member_number');
      (existing ?? []).forEach((m) => {
        if (m.email) existingByEmail.set(m.email.toLowerCase(), m.id);
        if (m.member_number) existingByMN.set(m.member_number.toLowerCase(), m.id);
      });
    } catch { /* ignore */ }

    const results = rawRows.map((row) => {
      const mapped: Record<string, string> = {};
      Object.entries(mapping).forEach(([csvH, dbK]) => { mapped[dbK] = row[csvH] ?? ''; });
      const result = validateMemberRow(mapped);
      const email = result.data.email?.toLowerCase();
      if (email && existingByEmail.has(email)) {
        result.warnings.push(`Duplikat: E-Mail existiert bereits`);
        result.isDuplicate = true;
        result.existingMemberId = existingByEmail.get(email);
      }
      const mn = result.data.member_number?.toLowerCase();
      if (mn && existingByMN.has(mn)) {
        result.warnings.push(`Duplikat: Mitgliedsnr. existiert bereits`);
        result.isDuplicate = true;
        result.existingMemberId = result.existingMemberId || existingByMN.get(mn);
      }
      return result;
    });

    setValidated(results);
    setIsChecking(false);
    setStep('preview');
  };

  const importMut = useMutation({
    mutationFn: async ({ inserts, updates }: { inserts: Record<string, any>[]; updates: { id: string; data: Record<string, any> }[] }) => {
      const t = inserts.length + updates.length;
      setTotal(t); setProgress(0);
      let ic = 0, uc = 0, p = 0;
      for (let i = 0; i < inserts.length; i += 100) {
        const chunk = inserts.slice(i, i + 100);
        const { error } = await supabase.from('members').insert(chunk as any);
        if (error) throw new Error(`Fehler (Zeile ${i + 1}): ${error.message}`);
        ic += chunk.length; p += chunk.length; setProgress(p);
      }
      for (const { id, data } of updates) {
        const { error } = await supabase.from('members').update(data as any).eq('id', id);
        if (error) throw new Error(`Fehler beim Update (${id}): ${error.message}`);
        uc++; p++; setProgress(p);
      }
      return { ic, uc };
    },
    onSuccess: ({ ic, uc }) => {
      const parts: string[] = [];
      if (ic > 0) parts.push(`${ic} neu importiert`);
      if (uc > 0) parts.push(`${uc} aktualisiert`);
      toast.success(`Mitglieder: ${parts.join(', ')}`);
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setStep('done');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const newRows = validated.filter((r) => r.errors.length === 0 && !r.isDuplicate);
  const dupRows = validated.filter((r) => r.isDuplicate && r.errors.length === 0 && r.existingMemberId);
  const errorRows = validated.filter((r) => r.errors.length > 0);
  const updRows = dupMode === 'update' ? dupRows : [];
  const totalImportable = newRows.length + updRows.length;

  const handleImport = () => {
    if (totalImportable === 0) { toast.error('Keine Zeilen zum Importieren'); return; }
    importMut.mutate({
      inserts: newRows.map((r) => r.data),
      updates: updRows.map((r) => ({ id: r.existingMemberId!, data: r.data })),
    });
  };

  const reset = () => { setStep('upload'); setRawRows([]); setHeaders([]); setMapping({}); setValidated([]); setFileName(''); };

  const downloadTemplate = () => {
    const header = MEMBER_COLS.map((c) => c.label).join(';');
    const example = 'Max;Mustermann;max@example.com;0171-1234567;01.01.1990;maennlich;Musterstr. 1;12345;Musterstadt;1001;01.01.2020;;;1500;1450;herren;';
    const blob = new Blob(['\uFEFF' + header + '\n' + example], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mitglieder_vorlage.csv'; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Mitglieder importieren</h2>
          <p className="text-sm text-muted-foreground">Importiere Mitgliederdaten aus CSV oder Excel</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="mr-2 h-4 w-4" /> CSV-Vorlage
        </Button>
      </div>

      {/* Steps */}
      <div className="flex gap-2">
        {(['upload', 'mapping', 'preview', 'done'] as MemberStep[]).map((s, i) => {
          const labels = ['Datei wählen', 'Spalten zuordnen', 'Vorschau & Import', 'Fertig'];
          const isActive = step === s;
          const isDone = ['upload', 'mapping', 'preview', 'done'].indexOf(step) > i;
          return <Badge key={s} variant={isActive ? 'default' : isDone ? 'secondary' : 'outline'} className="text-xs">{i + 1}. {labels[i]}</Badge>;
        })}
      </div>

      {step === 'upload' && (
        <Card><CardContent className="pt-6"><FileDropZone onFile={handleFile} /></CardContent></Card>
      )}

      {step === 'mapping' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spalten zuordnen</CardTitle>
            <CardDescription>Datei: <strong>{fileName}</strong> — {rawRows.length} Zeilen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border max-h-[400px] overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead>CSV-Spalte</TableHead><TableHead>Vorschau</TableHead><TableHead>Zuordnung</TableHead></TableRow></TableHeader>
                <TableBody>
                  {headers.map((h) => (
                    <TableRow key={h}>
                      <TableCell className="font-medium">{h}</TableCell>
                      <TableCell className="text-muted-foreground text-sm truncate max-w-[200px]">{rawRows[0]?.[h] ?? '–'}</TableCell>
                      <TableCell>
                        <Select value={mapping[h] ?? '__skip__'} onValueChange={(v) => setMapping((p) => { const n = { ...p }; if (v === '__skip__') delete n[h]; else n[h] = v; return n; })}>
                          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__skip__">— Überspringen —</SelectItem>
                            {MEMBER_COLS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label} {c.required ? '*' : ''}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>Zurück</Button>
              <Button onClick={proceedToPreview} disabled={isChecking}>{isChecking ? 'Prüfe…' : 'Weiter zur Vorschau'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6 flex items-center gap-3"><CheckCircle2 className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{totalImportable}</p><p className="text-sm text-muted-foreground">Gültig</p></div></CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-3"><AlertCircle className="h-8 w-8 text-destructive" /><div><p className="text-2xl font-bold">{errorRows.length}</p><p className="text-sm text-muted-foreground">Fehler</p></div></CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-3"><AlertCircle className="h-8 w-8 text-amber-500" /><div><p className="text-2xl font-bold">{dupRows.length}</p><p className="text-sm text-muted-foreground">Duplikate</p></div></CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-3"><AlertCircle className="h-8 w-8 text-amber-500" /><div><p className="text-2xl font-bold">{validated.filter((r) => r.warnings.length > 0).length}</p><p className="text-sm text-muted-foreground">Warnungen</p></div></CardContent></Card>
          </div>

          {dupRows.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="space-y-3">
                <p>{dupRows.length} Duplikat(e) erkannt.</p>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={dupMode === 'skip'} onChange={() => setDupMode('skip')} className="accent-primary" /><span className="text-sm">Überspringen</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={dupMode === 'update'} onChange={() => setDupMode('update')} className="accent-primary" /><span className="text-sm">Aktualisieren</span></label>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Vorschau</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-md border max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-[50px]">#</TableHead><TableHead>Status</TableHead><TableHead>Vorname</TableHead><TableHead>Nachname</TableHead><TableHead>E-Mail</TableHead><TableHead>Hinweise</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {validated.map((row, i) => (
                      <TableRow key={i} className={cn(row.errors.length > 0 ? 'bg-destructive/5' : '', row.isDuplicate && dupMode === 'skip' ? 'opacity-50' : '')}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          {row.errors.length > 0 ? <Badge variant="destructive" className="text-xs">Fehler</Badge> :
                           row.isDuplicate ? <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">Duplikat</Badge> :
                           row.warnings.length > 0 ? <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">Warnung</Badge> :
                           <Badge variant="secondary" className="text-xs">OK</Badge>}
                        </TableCell>
                        <TableCell>{row.data.first_name || '–'}</TableCell>
                        <TableCell>{row.data.last_name || '–'}</TableCell>
                        <TableCell className="text-muted-foreground">{row.data.email || '–'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">{[...row.errors, ...row.warnings].join('; ') || '–'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {importMut.isPending && total > 0 && (
            <Card><CardContent className="pt-6 space-y-2">
              <div className="flex justify-between text-sm"><span>Importiere…</span><span className="text-muted-foreground">{progress}/{total}</span></div>
              <Progress value={(progress / total) * 100} className="h-2" />
            </CardContent></Card>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('mapping')} disabled={importMut.isPending}>Zurück</Button>
            <Button onClick={handleImport} disabled={totalImportable === 0 || importMut.isPending}>
              {importMut.isPending ? `Importiere… (${progress}/${total})` : `${totalImportable} Mitglieder importieren`}
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <Card><CardContent className="pt-6 text-center space-y-4">
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
          <h2 className="text-xl font-semibold">Import abgeschlossen</h2>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={reset}>Neuer Import</Button>
            <Button onClick={() => window.location.href = '/mitglieder'}>Zur Mitgliederliste</Button>
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: Vereinsspielplan-Import
// ═══════════════════════════════════════════════════════════════════════════════

interface ParsedVSPRow {
  rowIndex: number;
  date: string;
  time: string | null;
  staffel: string;
  runde: string;
  homeTeam: string;
  awayTeam: string;
  isHome: boolean;
}

function ScheduleImportTab() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'config' | 'preview' | 'importing' | 'done'>('config');
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedVSPRow[]>([]);
  const [parseErrors, setParseErrors] = useState<Array<{ rowIndex: number; message: string }>>([]);
  const [teamId, setTeamId] = useState('');
  const [seasonPhaseId, setSeasonPhaseId] = useState('');
  const [clubName, setClubName] = useState('');
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number; staffelInfo: string[] } | null>(null);
  const [staffelFilter, setStaffelFilter] = useState<string>('__all__');

  // Load season phases (grouped by cycle)
  const { data: seasonPhases } = useQuery({
    queryKey: ['season-phases-import'],
    queryFn: async () => {
      const { data } = await supabase
        .from('season_phases')
        .select('id, name, phase_type, is_active, season_cycles(id, name, age_group)')
        .order('start_date', { ascending: false });
      return (data ?? []) as Array<{
        id: string;
        name: string;
        phase_type: string;
        is_active: boolean;
        season_cycles: { id: string; name: string; age_group: string } | null;
      }>;
    },
  });

  // Load teams for the selected phase
  const { data: teams } = useQuery({
    queryKey: ['teams-import-vsp', seasonPhaseId],
    queryFn: async () => {
      if (!seasonPhaseId) return [];
      const { data } = await supabase
        .from('teams')
        .select('id, name, season_id')
        .eq('season_phase_id', seasonPhaseId)
        .eq('is_active', true)
        .order('name');
      return data ?? [];
    },
    enabled: !!seasonPhaseId,
  });

  // Auto-fill club name from club_settings
  const { data: clubSettings } = useQuery({
    queryKey: ['club-settings-import'],
    queryFn: async () => {
      const { data } = await supabase.from('club_settings').select('club_name').limit(1).maybeSingle();
      return data;
    },
  });

  // Set club name when settings load
  useEffect(() => {
    if (clubSettings?.club_name && !clubName) {
      setClubName(clubSettings.club_name);
    }
  }, [clubSettings, clubName]);

  // Auto-select active phase
  useEffect(() => {
    if (!seasonPhaseId && seasonPhases?.length) {
      const active = seasonPhases.find((p) => p.is_active);
      if (active) setSeasonPhaseId(active.id);
    }
  }, [seasonPhases, seasonPhaseId]);

  const selectedTeam = teams?.find((t) => t.id === teamId);

  const parseFile = async () => {
    if (!file) { toast.error('Bitte Datei auswählen'); return; }
    if (!teamId || !seasonPhaseId || !clubName.trim()) {
      toast.error('Saisonphase, Mannschaft und Vereinsname ausfüllen');
      return;
    }

    try {
      // Parse with semicolon delimiter
      const rawRows = await new Promise<Record<string, string>[]>((resolve, reject) => {
        Papa.parse<Record<string, string>>(file, {
          header: true,
          skipEmptyLines: true,
          delimiter: ';',
          encoding: 'UTF-8',
          complete: (r) => resolve(r.data),
          error: (e) => reject(e),
        });
      });

      if (rawRows.length === 0) { toast.error('Leere Datei'); return; }

      // Validate expected columns
      const firstRow = rawRows[0];
      const expectedCols = ['Termin', 'HeimMannschaft', 'GastMannschaft'];
      const missingCols = expectedCols.filter((c) => !(c in firstRow));
      if (missingCols.length > 0) {
        toast.error(`Fehlende Spalten: ${missingCols.join(', ')}. Erwartetes Format: Termin;Wochentag;Staffel;Runde;HalleNr;HeimMannschaft;GastMannschaft`);
        return;
      }

      // Use normalizeVereinsspielplanRows from scheduleService
      const { normalizeVereinsspielplanRows, parseTermin, deriveIsHome } = await import('@/services/scheduleService');

      const results: ParsedVSPRow[] = [];
      const errs: Array<{ rowIndex: number; message: string }> = [];

      for (let i = 0; i < rawRows.length; i++) {
        const r = rawRows[i];
        const termin = r['Termin'] ?? '';
        const homeTeam = (r['HeimMannschaft'] ?? '').trim();
        const awayTeam = (r['GastMannschaft'] ?? '').trim();
        const staffel = (r['Staffel'] ?? '').trim();
        const runde = (r['Runde'] ?? '').trim();

        if (!homeTeam && !awayTeam) continue;
        if (homeTeam.toLowerCase() === 'spielfrei' || awayTeam.toLowerCase() === 'spielfrei') continue;

        const terminParsed = parseTermin(termin);
        if (!terminParsed) {
          errs.push({ rowIndex: i, message: `Ungültiger Termin: "${termin}"` });
          continue;
        }

        const isHome = deriveIsHome(homeTeam, clubName);

        results.push({
          rowIndex: i,
          date: terminParsed.date,
          time: terminParsed.time,
          staffel,
          runde,
          homeTeam,
          awayTeam,
          isHome,
        });
      }

      setParsed(results);
      setParseErrors(errs);
      setStaffelFilter('__all__');
      setStep('preview');
    } catch {
      toast.error('Fehler beim Parsen der Datei');
    }
  };

  const filteredParsed = staffelFilter === '__all__'
    ? parsed
    : parsed.filter((r) => r.staffel === staffelFilter);

  const uniqueStaffeln = useMemo(() =>
    Array.from(new Set(parsed.map((r) => r.staffel))).filter(Boolean).sort(),
    [parsed]
  );

  const importMut = useMutation({
    mutationFn: async () => {
      const seasonId = selectedTeam?.season_id;
      if (!seasonId) throw new Error('Saison-ID nicht gefunden');

      // Re-parse raw file and use the service
      const rawRows = await new Promise<Record<string, string>[]>((resolve, reject) => {
        Papa.parse<Record<string, string>>(file!, {
          header: true,
          skipEmptyLines: true,
          delimiter: ';',
          encoding: 'UTF-8',
          complete: (r) => resolve(r.data),
          error: (e) => reject(e),
        });
      });

      const { scheduleService } = await import('@/services/scheduleService');
      const result = await scheduleService.importFromVereinsspielplan(
        rawRows,
        teamId,
        seasonId,
        seasonPhaseId,
        clubName,
        true,
      );

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      setStep('done');
      toast.success(`${result.inserted} Spiele importiert${result.skipped > 0 ? `, ${result.skipped} übersprungen` : ''}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = () => {
    setStep('config');
    setFile(null);
    setParsed([]);
    setParseErrors([]);
    setImportResult(null);
    setStaffelFilter('__all__');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Vereinsspielplan importieren</h2>
          <p className="text-sm text-muted-foreground">
            Format: Termin;Wochentag;Staffel;Runde;HalleNr;HeimMannschaft;GastMannschaft
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex gap-2">
        {(['config', 'preview', 'done'] as const).map((s, i) => {
          const labels = ['Konfiguration & Datei', 'Vorschau & Import', 'Fertig'];
          const isActive = step === s || (step === 'importing' && s === 'preview');
          const isDone = ['config', 'preview', 'done'].indexOf(step) > i;
          return (
            <Badge key={s} variant={isActive ? 'default' : isDone ? 'secondary' : 'outline'} className="text-xs">
              {i + 1}. {labels[i]}
            </Badge>
          );
        })}
      </div>

      {step === 'config' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Saisonphase</Label>
                <Select value={seasonPhaseId} onValueChange={(v) => { setSeasonPhaseId(v); setTeamId(''); }}>
                  <SelectTrigger><SelectValue placeholder="Saisonphase wählen" /></SelectTrigger>
                  <SelectContent>
                    {seasonPhases?.map((sp) => (
                      <SelectItem key={sp.id} value={sp.id}>
                        {sp.season_cycles?.name ?? '–'} / {sp.name}
                        {sp.is_active ? ' ✓' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mannschaft</Label>
                <Select value={teamId} onValueChange={setTeamId} disabled={!seasonPhaseId}>
                  <SelectTrigger><SelectValue placeholder={seasonPhaseId ? 'Mannschaft wählen' : 'Erst Saisonphase wählen'} /></SelectTrigger>
                  <SelectContent>
                    {teams?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vereinsname (für Heim/Auswärts)</Label>
                <Input value={clubName} onChange={(e) => setClubName(e.target.value)} placeholder="z.B. TTC Zaberfeld" />
              </div>
            </div>

            <FileDropZone onFile={setFile} accept=".csv" hint="CSV-Datei mit Semikolon-Trennung (Vereinsspielplan)" />
            {file && <p className="text-sm text-muted-foreground">Datei: <strong>{file.name}</strong></p>}

            <Button onClick={parseFile} disabled={!file || !teamId || !seasonPhaseId || !clubName.trim()}>
              Datei analysieren
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{parsed.length}</p>
                  <p className="text-sm text-muted-foreground">Spiele erkannt</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <CalendarDays className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{parsed.filter((p) => p.isHome).length}</p>
                  <p className="text-sm text-muted-foreground">Heimspiele</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <TableProperties className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{uniqueStaffeln.length}</p>
                  <p className="text-sm text-muted-foreground">Staffeln</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">{parseErrors.length}</p>
                  <p className="text-sm text-muted-foreground">Fehler</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {parseErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {parseErrors.slice(0, 5).map((e, i) => (
                  <div key={i}>Zeile {e.rowIndex + 2}: {e.message}</div>
                ))}
                {parseErrors.length > 5 && <div className="mt-1 text-sm">… und {parseErrors.length - 5} weitere</div>}
              </AlertDescription>
            </Alert>
          )}

          {/* Staffel filter */}
          {uniqueStaffeln.length > 1 && (
            <div className="flex items-center gap-3">
              <Label className="text-sm">Staffel filtern:</Label>
              <Select value={staffelFilter} onValueChange={setStaffelFilter}>
                <SelectTrigger className="w-[300px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Alle Staffeln ({parsed.length})</SelectItem>
                  {uniqueStaffeln.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s} ({parsed.filter((p) => p.staffel === s).length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Preview table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vorschau</CardTitle>
              <CardDescription>
                {filteredParsed.length} Spiele
                {staffelFilter !== '__all__' ? ` in "${staffelFilter}"` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border max-h-[450px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Zeit</TableHead>
                      <TableHead>Staffel</TableHead>
                      <TableHead>Runde</TableHead>
                      <TableHead>Heim</TableHead>
                      <TableHead>Gast</TableHead>
                      <TableHead>H/A</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParsed.map((m) => (
                      <TableRow key={m.rowIndex}>
                        <TableCell>{fmtDate(m.date)}</TableCell>
                        <TableCell>{m.time ?? '–'}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{m.staffel}</TableCell>
                        <TableCell>
                          <Badge variant={m.runde === 'VR' ? 'secondary' : m.runde === 'RR' ? 'default' : 'outline'} className="text-xs">
                            {m.runde || '–'}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn(m.isHome && 'font-semibold text-primary')}>{m.homeTeam}</TableCell>
                        <TableCell className={cn(!m.isHome && 'font-semibold text-primary')}>{m.awayTeam}</TableCell>
                        <TableCell>
                          <Badge variant={m.isHome ? 'default' : 'outline'} className="text-xs">
                            {m.isHome ? 'Heim' : 'Auswärts'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={reset}>Zurück</Button>
            <Button
              onClick={() => importMut.mutate()}
              disabled={parsed.length === 0 || importMut.isPending}
            >
              {importMut.isPending ? 'Importiere…' : `${parsed.length} Spiele importieren`}
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
            <h2 className="text-xl font-semibold">Import abgeschlossen</h2>
            {importResult && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>{importResult.inserted}</strong> Spiele importiert</p>
                {importResult.skipped > 0 && <p><strong>{importResult.skipped}</strong> Duplikate übersprungen</p>}
                {importResult.staffelInfo.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1 mt-2">
                    {importResult.staffelInfo.map((s) => (
                      <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={reset}>Neuer Import</Button>
              <Button onClick={() => window.location.href = '/spielplan'}>Zum Spielplan</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: Pin/Code-Import
// ═══════════════════════════════════════════════════════════════════════════════

interface PinCodeRow {
  matchDay?: number;
  homeTeam?: string;
  awayTeam?: string;
  pin?: string;
  code?: string;
  matchId?: string;
  matched: boolean;
  error?: string;
}

function PinCodeImportTab() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [rows, setRows] = useState<PinCodeRow[]>([]);
  const [teamId, setTeamId] = useState('');
  const [seasonId, setSeasonId] = useState('');

  const { data: teams } = useQuery({
    queryKey: ['teams-pin'],
    queryFn: async () => { const { data } = await supabase.from('teams').select('id, name').eq('is_active', true).order('name'); return data ?? []; },
  });

  const { data: seasons } = useQuery({
    queryKey: ['seasons-pin'],
    queryFn: async () => { const { data } = await supabase.from('seasons').select('id, name').order('start_date', { ascending: false }); return data ?? []; },
  });

  const handleFile = async (file: File) => {
    if (!teamId || !seasonId) { toast.error('Mannschaft und Saison wählen'); return; }

    try {
      const raw = await parseFileToRows(file);
      // Load matches for matching
      const { data: matches } = await supabase
        .from('schedule_matches')
        .select('id, match_day, home_team, away_team')
        .eq('team_id', teamId)
        .eq('season_id', seasonId);

      const matchList = matches ?? [];

      const parsed: PinCodeRow[] = raw.map((r) => {
        const matchDay = parseInt(r['Spieltag'] || r['match_day'] || r['Nr'] || '0', 10);
        const homeTeam = (r['Heim'] || r['home_team'] || r['Heimmannschaft'] || '').trim();
        const awayTeam = (r['Gast'] || r['away_team'] || r['Gastmannschaft'] || '').trim();
        const pin = (r['PIN'] || r['pin'] || r['Pin'] || '').trim() || undefined;
        const code = (r['Code'] || r['code'] || '').trim() || undefined;

        // Auto-match
        let matched = false;
        let matchId: string | undefined;
        const match = matchList.find((m) =>
          (matchDay && m.match_day === matchDay) ||
          (homeTeam && m.home_team.toLowerCase().includes(homeTeam.toLowerCase()) && awayTeam && m.away_team.toLowerCase().includes(awayTeam.toLowerCase()))
        );
        if (match) { matched = true; matchId = match.id; }

        return { matchDay, homeTeam, awayTeam, pin, code, matchId, matched, error: !pin && !code ? 'Kein PIN/Code' : undefined };
      });

      setRows(parsed);
      setStep('preview');
    } catch {
      toast.error('Fehler beim Lesen');
    }
  };

  const setManualMatch = (idx: number, matchId: string) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, matchId, matched: true } : r));
  };

  const matchedRows = rows.filter((r) => r.matched && r.matchId && (r.pin || r.code));

  const importMut = useMutation({
    mutationFn: async () => {
      let updated = 0;
      for (const r of matchedRows) {
        const patch: Record<string, string | null> = {};
        if (r.pin) patch.pin = r.pin;
        if (r.code) patch.code = r.code;
        const { error } = await supabase.from('schedule_matches').update(patch).eq('id', r.matchId!);
        if (error) throw error;
        updated++;
      }
      return updated;
    },
    onSuccess: (n) => { toast.success(`${n} Spiele aktualisiert`); queryClient.invalidateQueries({ queryKey: ['schedule'] }); setStep('done'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: matchOptions } = useQuery({
    queryKey: ['matches-for-pin', teamId, seasonId],
    queryFn: async () => {
      if (!teamId || !seasonId) return [];
      const { data } = await supabase.from('schedule_matches').select('id, match_day, home_team, away_team').eq('team_id', teamId).eq('season_id', seasonId).order('match_date');
      return data ?? [];
    },
    enabled: !!teamId && !!seasonId,
  });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">PIN/Code-Import</h2>
      <p className="text-sm text-muted-foreground">Importiere PINs und Codes und ordne sie automatisch den Spielen zu</p>

      {step === 'upload' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Saison</Label>
                <Select value={seasonId} onValueChange={setSeasonId}><SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger><SelectContent>{seasons?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-2">
                <Label>Mannschaft</Label>
                <Select value={teamId} onValueChange={setTeamId}><SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger><SelectContent>{teams?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <FileDropZone onFile={handleFile} />
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card><CardContent className="pt-6 flex items-center gap-3"><CheckCircle2 className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{matchedRows.length}</p><p className="text-sm text-muted-foreground">Zugeordnet</p></div></CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-3"><AlertCircle className="h-8 w-8 text-amber-500" /><div><p className="text-2xl font-bold">{rows.filter((r) => !r.matched).length}</p><p className="text-sm text-muted-foreground">Nicht zugeordnet</p></div></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Zuordnung</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-md border max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Spieltag</TableHead><TableHead>Heim</TableHead><TableHead>Gast</TableHead><TableHead>PIN</TableHead><TableHead>Code</TableHead><TableHead>Zuordnung</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i} className={cn(!r.matched && 'bg-amber-500/5')}>
                        <TableCell>{r.matchDay || '–'}</TableCell>
                        <TableCell>{r.homeTeam || '–'}</TableCell>
                        <TableCell>{r.awayTeam || '–'}</TableCell>
                        <TableCell className="font-mono">{r.pin || '–'}</TableCell>
                        <TableCell className="font-mono">{r.code || '–'}</TableCell>
                        <TableCell>
                          {r.matched ? <Badge variant="secondary" className="text-xs">✓ Zugeordnet</Badge> : (
                            <Select value={r.matchId ?? ''} onValueChange={(v) => setManualMatch(i, v)}>
                              <SelectTrigger className="w-[250px]"><SelectValue placeholder="Manuell zuordnen" /></SelectTrigger>
                              <SelectContent>{matchOptions?.map((m) => <SelectItem key={m.id} value={m.id}>ST{m.match_day}: {m.home_team} – {m.away_team}</SelectItem>)}</SelectContent>
                            </Select>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setStep('upload'); setRows([]); }}>Zurück</Button>
            <Button onClick={() => importMut.mutate()} disabled={matchedRows.length === 0 || importMut.isPending}>
              {importMut.isPending ? 'Importiere…' : `${matchedRows.length} PINs/Codes importieren`}
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <Card><CardContent className="pt-6 text-center space-y-4">
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
          <h2 className="text-xl font-semibold">Import abgeschlossen</h2>
          <Button variant="outline" onClick={() => { setStep('upload'); setRows([]); }}>Neuer Import</Button>
        </CardContent></Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: QTTR/TTR-Import
// ═══════════════════════════════════════════════════════════════════════════════

interface RatingRow {
  name: string;
  firstName: string;
  lastName: string;
  ttr: number | null;
  qttr: number | null;
  memberId?: string;
  matched: boolean;
}

function RatingImportTab() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [rows, setRows] = useState<RatingRow[]>([]);

  const { data: allMembers } = useQuery({
    queryKey: ['members-rating-import'],
    queryFn: async () => { const { data } = await supabase.from('members').select('id, first_name, last_name').eq('is_active', true).order('last_name'); return data ?? []; },
  });

  const handleFile = async (file: File) => {
    try {
      const raw = await parseFileToRows(file);
      const members = allMembers ?? [];

      const parsed: RatingRow[] = raw.map((r) => {
        const firstName = (r['Vorname'] || r['first_name'] || '').trim();
        const lastName = (r['Nachname'] || r['last_name'] || r['Name'] || '').trim();
        const ttrRaw = r['TTR'] || r['ttr'] || r['TTR-Punkte'] || '';
        const qttrRaw = r['QTTR'] || r['qttr'] || r['Q-TTR'] || '';
        const ttr = ttrRaw ? parseInt(ttrRaw, 10) : null;
        const qttr = qttrRaw ? parseInt(qttrRaw, 10) : null;
        const name = `${firstName} ${lastName}`.trim();

        // Auto-match by name
        const match = members.find((m) =>
          m.first_name.toLowerCase() === firstName.toLowerCase() &&
          m.last_name.toLowerCase() === lastName.toLowerCase()
        );

        return { name, firstName, lastName, ttr: isNaN(ttr!) ? null : ttr, qttr: isNaN(qttr!) ? null : qttr, memberId: match?.id, matched: !!match };
      }).filter((r) => r.name && (r.ttr != null || r.qttr != null));

      setRows(parsed);
      setStep('preview');
    } catch {
      toast.error('Fehler beim Lesen');
    }
  };

  const setManualMatch = (idx: number, memberId: string) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, memberId, matched: true } : r));
  };

  const matchedRows = rows.filter((r) => r.matched && r.memberId);

  const importMut = useMutation({
    mutationFn: async () => {
      let updated = 0;
      for (const r of matchedRows) {
        const patch: Record<string, number | null> = {};
        if (r.ttr != null) patch.ttr_rating = r.ttr;
        if (r.qttr != null) patch.qttr_rating = r.qttr;
        const { error } = await supabase.from('members').update(patch).eq('id', r.memberId!);
        if (error) throw error;
        updated++;
      }
      return updated;
    },
    onSuccess: (n) => { toast.success(`${n} Mitglieder aktualisiert`); queryClient.invalidateQueries({ queryKey: ['members'] }); setStep('done'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadTemplate = () => {
    const csv = 'Vorname;Nachname;TTR;QTTR\nMax;Mustermann;1500;1450\n';
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ttr_vorlage.csv'; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">QTTR/TTR-Import</h2>
          <p className="text-sm text-muted-foreground">Aktualisiere TTR- und QTTR-Werte aus CSV oder Excel</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4" /> Vorlage</Button>
      </div>

      {step === 'upload' && (
        <Card><CardContent className="pt-6"><FileDropZone onFile={handleFile} /></CardContent></Card>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card><CardContent className="pt-6 flex items-center gap-3"><CheckCircle2 className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{matchedRows.length}</p><p className="text-sm text-muted-foreground">Zugeordnet</p></div></CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-3"><AlertCircle className="h-8 w-8 text-amber-500" /><div><p className="text-2xl font-bold">{rows.filter((r) => !r.matched).length}</p><p className="text-sm text-muted-foreground">Nicht zugeordnet</p></div></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Zuordnung</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-md border max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>TTR</TableHead><TableHead>QTTR</TableHead><TableHead>Zuordnung</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i} className={cn(!r.matched && 'bg-amber-500/5')}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.ttr ?? '–'}</TableCell>
                        <TableCell>{r.qttr ?? '–'}</TableCell>
                        <TableCell>
                          {r.matched ? <Badge variant="secondary" className="text-xs">✓ {allMembers?.find((m) => m.id === r.memberId)?.first_name} {allMembers?.find((m) => m.id === r.memberId)?.last_name}</Badge> : (
                            <Select value={r.memberId ?? ''} onValueChange={(v) => setManualMatch(i, v)}>
                              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Manuell zuordnen" /></SelectTrigger>
                              <SelectContent>{allMembers?.map((m) => <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>)}</SelectContent>
                            </Select>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setStep('upload'); setRows([]); }}>Zurück</Button>
            <Button onClick={() => importMut.mutate()} disabled={matchedRows.length === 0 || importMut.isPending}>
              {importMut.isPending ? 'Importiere…' : `${matchedRows.length} Werte importieren`}
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <Card><CardContent className="pt-6 text-center space-y-4">
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
          <h2 className="text-xl font-semibold">Import abgeschlossen</h2>
          <Button variant="outline" onClick={() => { setStep('upload'); setRows([]); }}>Neuer Import</Button>
        </CardContent></Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════════

const TABS = [
  { key: 'mitglieder', label: 'Mitglieder', icon: FileText },
  { key: 'spielplan', label: 'Spielplan', icon: TableProperties },
  { key: 'pin-code', label: 'PIN/Code', icon: KeyRound },
  { key: 'ttr', label: 'QTTR/TTR', icon: Trophy },
] as const;

export default function Import() {
  const [params, setParams] = useSearchParams();
  const activeTab = params.get('tab') || 'mitglieder';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Datenimport</h1>
        <p className="text-muted-foreground">Importiere Daten aus CSV- und Excel-Dateien</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList>
          {TABS.map(({ key, label, icon: Icon }) => (
            <TabsTrigger key={key} value={key} className="gap-2">
              <Icon className="h-4 w-4" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="mitglieder"><MemberImportTab /></TabsContent>
        <TabsContent value="spielplan"><ScheduleImportTab /></TabsContent>
        <TabsContent value="pin-code"><PinCodeImportTab /></TabsContent>
        <TabsContent value="ttr"><RatingImportTab /></TabsContent>
      </Tabs>
    </div>
  );
}
