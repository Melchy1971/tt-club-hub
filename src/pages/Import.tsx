import { useState, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, AlertCircle, CheckCircle2, X, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Alert, AlertDescription,
} from '@/components/ui/alert';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  CSV column definitions                                            */
/* ------------------------------------------------------------------ */

interface CsvColumnDef {
  key: string;
  label: string;
  required?: boolean;
}

const CSV_COLUMNS: CsvColumnDef[] = [
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

const DB_KEYS = CSV_COLUMNS.map((c) => c.key);

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else current += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ';' || ch === ',') { result.push(current.trim()); current = ''; }
        else current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9äöüß]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

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

function autoMapHeaders(headers: string[]): Record<number, string> {
  const mapping: Record<number, string> = {};
  const used = new Set<string>();
  headers.forEach((h, i) => {
    const norm = normalizeHeader(h);
    // direct match
    if (DB_KEYS.includes(norm) && !used.has(norm)) { mapping[i] = norm; used.add(norm); return; }
    // alias match
    const alias = HEADER_ALIASES[norm];
    if (alias && !used.has(alias)) { mapping[i] = alias; used.add(alias); return; }
  });
  return mapping;
}

const VALID_GENDERS = ['maennlich', 'weiblich', 'divers'];
const GENDER_MAP: Record<string, string> = {
  m: 'maennlich', männlich: 'maennlich', maennlich: 'maennlich', male: 'maennlich',
  w: 'weiblich', weiblich: 'weiblich', female: 'weiblich',
  d: 'divers', divers: 'divers', diverse: 'divers',
};

const VALID_AGE_GROUPS = [
  'herren', 'damen', 'jungen_18', 'maedchen_18', 'jungen_15', 'maedchen_15',
  'jungen_13', 'maedchen_13', 'jungen_11', 'maedchen_11', 'senioren', 'seniorinnen',
];

function parseDate(val: string): string | null {
  if (!val) return null;
  // DD.MM.YYYY
  const de = val.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (de) return `${de[3]}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}`;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  return null;
}

interface RowValidation {
  data: Record<string, any>;
  errors: string[];
  warnings: string[];
  isDuplicate?: boolean;
  existingMemberId?: string; // ID of existing member if duplicate
}

type DuplicateMode = 'skip' | 'update';

function validateRow(raw: Record<string, string>): RowValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, any> = {};

  // Required
  if (!raw.first_name?.trim()) errors.push('Vorname fehlt');
  if (!raw.last_name?.trim()) errors.push('Nachname fehlt');

  data.first_name = raw.first_name?.trim() || '';
  data.last_name = raw.last_name?.trim() || '';
  data.email = raw.email?.trim() || null;
  data.phone = raw.phone?.trim() || null;
  data.street = raw.street?.trim() || null;
  data.zip_code = raw.zip_code?.trim() || null;
  data.city = raw.city?.trim() || null;
  data.member_number = raw.member_number?.trim() || null;
  data.notes = raw.notes?.trim() || null;

  // Email validation
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    warnings.push('Ungültige E-Mail');
  }

  // Dates
  if (raw.date_of_birth?.trim()) {
    const d = parseDate(raw.date_of_birth.trim());
    if (!d) warnings.push('Ungültiges Geburtsdatum');
    data.date_of_birth = d;
  } else { data.date_of_birth = null; }

  if (raw.entry_date?.trim()) {
    const d = parseDate(raw.entry_date.trim());
    if (!d) warnings.push('Ungültiges Eintrittsdatum');
    data.entry_date = d || new Date().toISOString().slice(0, 10);
  } else { data.entry_date = new Date().toISOString().slice(0, 10); }

  if (raw.exit_date?.trim()) {
    const d = parseDate(raw.exit_date.trim());
    if (!d) warnings.push('Ungültiges Austrittsdatum');
    data.exit_date = d;
  } else { data.exit_date = null; }

  // Gender
  if (raw.gender?.trim()) {
    const g = GENDER_MAP[raw.gender.trim().toLowerCase()];
    if (g) data.gender = g;
    else { warnings.push(`Unbekanntes Geschlecht: "${raw.gender}"`); data.gender = null; }
  } else { data.gender = null; }

  // Ratings
  for (const key of ['ttr_rating', 'qttr_rating'] as const) {
    if (raw[key]?.trim()) {
      const n = parseInt(raw[key].trim(), 10);
      if (isNaN(n) || n < 0 || n > 3500) { warnings.push(`Ungültiger ${key === 'ttr_rating' ? 'TTR' : 'QTTR'}-Wert`); data[key] = null; }
      else data[key] = n;
    } else { data[key] = null; }
  }

  // Age group
  if (raw.age_group?.trim()) {
    const ag = raw.age_group.trim().toLowerCase();
    if (VALID_AGE_GROUPS.includes(ag)) data.age_group = ag;
    else { warnings.push(`Unbekannte Altersgruppe: "${raw.age_group}"`); data.age_group = null; }
  } else { data.age_group = null; }

  data.is_active = true;

  return { data, errors, warnings };
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

type Step = 'upload' | 'mapping' | 'preview' | 'done';

export default function Import() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({});
  const [validatedRows, setValidatedRows] = useState<RowValidation[]>([]);
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('skip');

  /* Upload */
  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Bitte eine CSV-Datei auswählen');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0) { toast.error('Leere CSV-Datei'); return; }
      setCsvHeaders(headers);
      setCsvRows(rows);
      const mapping = autoMapHeaders(headers);
      setColumnMapping(mapping);
      setStep('mapping');
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  /* Mapping */
  const setMapping = (colIndex: number, dbKey: string) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      if (dbKey === '__skip__') { delete next[colIndex]; }
      else { next[colIndex] = dbKey; }
      return next;
    });
  };


  const proceedToPreview = async () => {
    // Check required columns mapped
    const mapped = new Set(Object.values(columnMapping));
    const missing = CSV_COLUMNS.filter((c) => c.required && !mapped.has(c.key));
    if (missing.length > 0) {
      toast.error(`Pflichtfelder nicht zugeordnet: ${missing.map((c) => c.label).join(', ')}`);
      return;
    }

    setIsChecking(true);

    // Fetch existing members for duplicate check
    const existingByEmail = new Map<string, string>(); // email -> id
    const existingByMemberNumber = new Map<string, string>(); // member_number -> id
    try {
      const { data: existing } = await supabase
        .from('members')
        .select('id, email, member_number');
      (existing ?? []).forEach((m) => {
        if (m.email) existingByEmail.set(m.email.toLowerCase(), m.id);
        if (m.member_number) existingByMemberNumber.set(m.member_number.toLowerCase(), m.id);
      });
    } catch { /* ignore */ }

    // Build row objects and check duplicates
    const seenEmails = new Set<string>();
    const seenMemberNumbers = new Set<string>();

    const validated = csvRows.map((row) => {
      const raw: Record<string, string> = {};
      Object.entries(columnMapping).forEach(([colIdx, dbKey]) => {
        raw[dbKey] = row[Number(colIdx)] ?? '';
      });
      const result = validateRow(raw);

      // Duplicate check: existing DB
      const email = result.data.email?.toLowerCase();
      if (email && existingByEmail.has(email)) {
        result.warnings.push(`Duplikat: E-Mail "${result.data.email}" existiert bereits`);
        result.isDuplicate = true;
        result.existingMemberId = existingByEmail.get(email);
      }
      const mn = result.data.member_number?.toLowerCase();
      if (mn && existingByMemberNumber.has(mn)) {
        result.warnings.push(`Duplikat: Mitgliedsnr. "${result.data.member_number}" existiert bereits`);
        result.isDuplicate = true;
        result.existingMemberId = result.existingMemberId || existingByMemberNumber.get(mn);
      }

      // Duplicate check: within CSV
      if (email) {
        if (seenEmails.has(email)) {
          result.warnings.push(`Duplikat in CSV: E-Mail "${result.data.email}"`);
          result.isDuplicate = true;
        }
        seenEmails.add(email);
      }
      if (mn) {
        if (seenMemberNumbers.has(mn)) {
          result.warnings.push(`Duplikat in CSV: Mitgliedsnr. "${result.data.member_number}"`);
          result.isDuplicate = true;
        }
        seenMemberNumbers.add(mn);
      }

      return result;
    });

    setValidatedRows(validated);
    setIsChecking(false);
    setStep('preview');
  };

  /* Import */
  const importMut = useMutation({
    mutationFn: async ({ inserts, updates }: { inserts: Record<string, any>[]; updates: { id: string; data: Record<string, any> }[] }) => {
      const chunkSize = 100;
      let insertedCount = 0;
      let updatedCount = 0;

      // Insert new rows
      for (let i = 0; i < inserts.length; i += chunkSize) {
        const chunk = inserts.slice(i, i + chunkSize);
        const { error } = await supabase.from('members').insert(chunk as any);
        if (error) throw new Error(`Fehler beim Einfügen (Zeile ${i + 1}): ${error.message}`);
        insertedCount += chunk.length;
      }

      // Update existing rows
      for (const { id, data } of updates) {
        const { error } = await supabase.from('members').update(data as any).eq('id', id);
        if (error) throw new Error(`Fehler beim Aktualisieren (${id}): ${error.message}`);
        updatedCount++;
      }

      return { insertedCount, updatedCount };
    },
    onSuccess: ({ insertedCount, updatedCount }) => {
      const parts: string[] = [];
      if (insertedCount > 0) parts.push(`${insertedCount} neu importiert`);
      if (updatedCount > 0) parts.push(`${updatedCount} aktualisiert`);
      toast.success(`Mitglieder: ${parts.join(', ')}`);
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setStep('done');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateRows = validatedRows.filter((r) => r.isDuplicate && r.errors.length === 0 && r.existingMemberId);
  const csvOnlyDuplicates = validatedRows.filter((r) => r.isDuplicate && r.errors.length === 0 && !r.existingMemberId);
  const newRows = validatedRows.filter((r) => r.errors.length === 0 && !r.isDuplicate);
  const errorRows = validatedRows.filter((r) => r.errors.length > 0);

  const importableNewRows = [...newRows, ...csvOnlyDuplicates.filter((_, i) => i === 0 || !skipDuplicates)];
  const importableDuplicateUpdates = duplicateMode === 'update' ? duplicateRows : [];
  const skippedDuplicates = duplicateMode === 'skip' ? duplicateRows : [];

  const totalImportable = importableNewRows.length + importableDuplicateUpdates.length;

  const handleImport = () => {
    if (totalImportable === 0) { toast.error('Keine Zeilen zum Importieren'); return; }

    const inserts = importableNewRows.map((r) => r.data);
    const updates = importableDuplicateUpdates.map((r) => ({
      id: r.existingMemberId!,
      data: r.data,
    }));

    importMut.mutate({ inserts, updates });
  };

  const reset = () => {
    setStep('upload');
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMapping({});
    setValidatedRows([]);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const downloadTemplate = () => {
    const header = CSV_COLUMNS.map((c) => c.label).join(';');
    const example = 'Max;Mustermann;max@example.com;0171-1234567;01.01.1990;maennlich;Musterstr. 1;12345;Musterstadt;1001;01.01.2020;;;1500;1450;herren;';
    const csv = `${header}\n${example}`;
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mitglieder_vorlage.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mitglieder importieren</h1>
          <p className="text-muted-foreground">
            Importiere Mitgliederdaten aus einer CSV-Datei
          </p>
        </div>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="mr-2 h-4 w-4" /> Vorlage herunterladen
        </Button>
      </div>

      {/* Steps indicator */}
      <div className="flex gap-2">
        {(['upload', 'mapping', 'preview', 'done'] as Step[]).map((s, i) => {
          const labels = ['Datei wählen', 'Spalten zuordnen', 'Vorschau & Import', 'Fertig'];
          const isActive = step === s;
          const isDone = ['upload', 'mapping', 'preview', 'done'].indexOf(step) > i;
          return (
            <Badge
              key={s}
              variant={isActive ? 'default' : isDone ? 'secondary' : 'outline'}
              className="text-xs"
            >
              {i + 1}. {labels[i]}
            </Badge>
          );
        })}
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">CSV-Datei hochladen</CardTitle>
            <CardDescription>
              Lade eine CSV-Datei mit Mitgliederdaten hoch. Die Spalten werden automatisch erkannt.
              Trennzeichen: Semikolon (;) oder Komma (,).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors',
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm font-medium">CSV-Datei hierher ziehen oder klicken</p>
              <p className="text-xs text-muted-foreground mt-1">Unterstützt: .csv (UTF-8)</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
          </CardContent>
        </Card>
      )}

      {/* Step: Mapping */}
      {step === 'mapping' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Spalten zuordnen</CardTitle>
            <CardDescription>
              Datei: <strong>{fileName}</strong> — {csvRows.length} Zeilen erkannt.
              Ordne die CSV-Spalten den Datenbankfeldern zu.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CSV-Spalte</TableHead>
                    <TableHead>Vorschau (Zeile 1)</TableHead>
                    <TableHead>Zuordnung</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvHeaders.map((header, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{header}</TableCell>
                      <TableCell className="text-muted-foreground text-sm truncate max-w-[200px]">
                        {csvRows[0]?.[i] ?? '–'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={columnMapping[i] ?? '__skip__'}
                          onValueChange={(v) => setMapping(i, v)}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__skip__">— Überspringen —</SelectItem>
                            {CSV_COLUMNS.map((col) => (
                              <SelectItem key={col.key} value={col.key}>
                                {col.label} {col.required ? '*' : ''}
                              </SelectItem>
                            ))}
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
              <Button onClick={proceedToPreview} disabled={isChecking}>
                {isChecking ? 'Prüfe Duplikate…' : 'Weiter zur Vorschau'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex gap-4">
            <Card className="flex-1">
              <CardContent className="pt-6 flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{totalImportable}</p>
                  <p className="text-sm text-muted-foreground">Gültige Zeilen</p>
                </div>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="pt-6 flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">{errorRows.length}</p>
                  <p className="text-sm text-muted-foreground">Fehlerhafte Zeilen</p>
                </div>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="pt-6 flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">{duplicateRows.length}</p>
                  <p className="text-sm text-muted-foreground">Duplikate</p>
                </div>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="pt-6 flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">{validatedRows.filter((r) => r.warnings.length > 0).length}</p>
                  <p className="text-sm text-muted-foreground">Warnungen</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {duplicateRows.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="space-y-3">
                <p>
                  {duplicateRows.length} Duplikat{duplicateRows.length !== 1 ? 'e' : ''} erkannt (gleiche E-Mail oder Mitgliedsnr.).
                </p>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="duplicateMode"
                      checked={duplicateMode === 'skip'}
                      onChange={() => setDuplicateMode('skip')}
                      className="accent-primary"
                    />
                    <span className="text-sm">Duplikate überspringen</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="duplicateMode"
                      checked={duplicateMode === 'update'}
                      onChange={() => setDuplicateMode('update')}
                      className="accent-primary"
                    />
                    <span className="text-sm">Bestehende Mitglieder aktualisieren</span>
                  </label>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {errorRows.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {errorRows.length} Zeile{errorRows.length !== 1 ? 'n' : ''} mit Fehlern werden nicht importiert.
              </AlertDescription>
            </Alert>
          )}

          {/* Preview table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vorschau</CardTitle>
              <CardDescription>Prüfe die Daten vor dem Import</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Vorname</TableHead>
                      <TableHead>Nachname</TableHead>
                      <TableHead>E-Mail</TableHead>
                      <TableHead>Mitgliedsnr.</TableHead>
                      <TableHead>Hinweise</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validatedRows.map((row, i) => (
                      <TableRow key={i} className={cn(
                        row.errors.length > 0 ? 'bg-destructive/5' : '',
                        row.isDuplicate && skipDuplicates ? 'opacity-50' : '',
                      )}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          {row.errors.length > 0 ? (
                            <Badge variant="destructive" className="text-xs">Fehler</Badge>
                          ) : row.isDuplicate ? (
                            <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">Duplikat</Badge>
                          ) : row.warnings.length > 0 ? (
                            <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">Warnung</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">OK</Badge>
                          )}
                        </TableCell>
                        <TableCell>{row.data.first_name || '–'}</TableCell>
                        <TableCell>{row.data.last_name || '–'}</TableCell>
                        <TableCell className="text-muted-foreground">{row.data.email || '–'}</TableCell>
                        <TableCell className="text-muted-foreground">{row.data.member_number || '–'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">
                          {[...row.errors, ...row.warnings].join('; ') || '–'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('mapping')}>Zurück</Button>
            <Button
              onClick={handleImport}
              disabled={totalImportable === 0 || importMut.isPending}
            >
              {importMut.isPending
                ? 'Importiere…'
                : `${totalImportable} Mitglied${totalImportable !== 1 ? 'er' : ''} importieren${importableDuplicateUpdates.length > 0 ? ` (${importableDuplicateUpdates.length} Updates)` : ''}`}
            </Button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && (
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
            <div>
              <h2 className="text-xl font-semibold">Import abgeschlossen</h2>
              <p className="text-muted-foreground">
                Der Import wurde erfolgreich durchgeführt.
              </p>
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={reset}>Weiteren Import starten</Button>
              <Button onClick={() => window.location.href = '/mitglieder'}>Zur Mitgliederliste</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
