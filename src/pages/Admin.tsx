import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { TeamEditDialog } from '@/components/admin/TeamEditDialog';
import { TeamRosterDialog } from '@/components/admin/TeamRosterDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Users,
  Shield,
  CalendarDays,
  KeyRound,
  Database,
  Trash2,
  Search,
  Download,
  Copy,
  CheckCircle2,
  Plus,
  Pencil,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { csvAdapter } from '@/lib/export/csvAdapter';
import type { ExportDocument } from '@/lib/export/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return '–';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 rounded-md" />
      ))}
    </div>
  );
}

const TABS = [
  { value: 'mitglieder', label: 'Mitglieder', icon: Users },
  { value: 'mannschaften', label: 'Mannschaften', icon: Shield },
  { value: 'spielplan', label: 'Spielplan', icon: CalendarDays },
  { value: 'pins', label: 'PINs & Codes', icon: KeyRound },
  { value: 'backup', label: 'Backup', icon: Database },
  { value: 'loeschanfragen', label: 'Löschanfragen', icon: Trash2 },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: Mitglieder
// ═══════════════════════════════════════════════════════════════════════════════

function MembersAdminTab() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const { data: members, isLoading } = useQuery({
    queryKey: ['admin-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('last_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!members) return [];
    return members.filter((m) => {
      if (statusFilter === 'active' && !m.is_active) return false;
      if (statusFilter === 'inactive' && m.is_active) return false;
      if (search) {
        const s = search.toLowerCase();
        return [m.first_name, m.last_name, m.email, m.member_number]
          .some((f) => (f ?? '').toLowerCase().includes(s));
      }
      return true;
    });
  }, [members, search, statusFilter]);

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Name, E-Mail, Mitgliedsnr. suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'active', 'inactive'] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? 'default' : 'outline'}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'Alle' : s === 'active' ? 'Aktiv' : 'Inaktiv'}
            </Button>
          ))}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        {filtered.length} von {members?.length ?? 0} Mitgliedern
      </div>

      {!filtered.length ? (
        <EmptyState icon={Users} title="Keine Mitglieder gefunden" description="Ändere deine Suchkriterien." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nr.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>TTR</TableHead>
                <TableHead>QTTR</TableHead>
                <TableHead>Eintritt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm text-muted-foreground">{m.member_number ?? '–'}</TableCell>
                  <TableCell className="font-medium">{m.first_name} {m.last_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.email ?? '–'}</TableCell>
                  <TableCell>
                    <Badge variant={m.is_active ? 'default' : 'secondary'}>
                      {m.is_active ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{m.ttr_rating ?? '–'}</TableCell>
                  <TableCell className="text-sm">{m.qttr_rating ?? '–'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDate(m.entry_date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: Mannschaften
// ═══════════════════════════════════════════════════════════════════════════════

function TeamsAdminTab() {
  const [search, setSearch] = useState('');

  const { data: teams, isLoading } = useQuery({
    queryKey: ['admin-teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*, team_members(count)')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!teams) return [];
    if (!search) return teams;
    const s = search.toLowerCase();
    return teams.filter((t) =>
      [t.name, t.league, t.division].some((f) => (f ?? '').toLowerCase().includes(s))
    );
  }, [teams, search]);

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Mannschaft suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {!filtered.length ? (
        <EmptyState icon={Shield} title="Keine Mannschaften" description="Es wurden noch keine Mannschaften angelegt." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Liga</TableHead>
                <TableHead>Staffel</TableHead>
                <TableHead>Spieler</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.league ?? '–'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.division ?? '–'}</TableCell>
                  <TableCell className="text-sm">{t.team_members?.[0]?.count ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={t.is_active ? 'default' : 'secondary'}>
                      {t.is_active ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: Spielplan
// ═══════════════════════════════════════════════════════════════════════════════

function ScheduleAdminTab() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: matches, isLoading } = useQuery({
    queryKey: ['admin-schedule'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_matches')
        .select('*, teams(name)')
        .order('match_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const STATUS_LABELS: Record<string, string> = {
    geplant: 'Geplant',
    laufend: 'Laufend',
    beendet: 'Beendet',
    verschoben: 'Verschoben',
    abgesagt: 'Abgesagt',
  };

  const filtered = useMemo(() => {
    if (!matches) return [];
    return matches.filter((m: any) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return [m.home_team, m.away_team, m.teams?.name]
          .some((f) => (f ?? '').toLowerCase().includes(s));
      }
      return true;
    });
  }, [matches, search, statusFilter]);

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Mannschaft oder Gegner suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1 flex-wrap">
          <Button size="sm" variant={statusFilter === 'all' ? 'default' : 'outline'} onClick={() => setStatusFilter('all')}>Alle</Button>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <Button key={k} size="sm" variant={statusFilter === k ? 'default' : 'outline'} onClick={() => setStatusFilter(k)}>{v}</Button>
          ))}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">{filtered.length} Spiele</div>

      {!filtered.length ? (
        <EmptyState icon={CalendarDays} title="Keine Spiele" description="Keine Spiele für die gewählten Filter gefunden." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ST</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Mannschaft</TableHead>
                <TableHead>Begegnung</TableHead>
                <TableHead>Ergebnis</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm">{m.match_day ?? '–'}</TableCell>
                  <TableCell className="text-sm">{fmtDate(m.match_date)}{m.match_time ? ` ${m.match_time.slice(0, 5)}` : ''}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.teams?.name ?? '–'}</TableCell>
                  <TableCell className="font-medium text-sm">{m.home_team} – {m.away_team}</TableCell>
                  <TableCell className="text-sm">
                    {m.home_score != null && m.away_score != null ? `${m.home_score}:${m.away_score}` : '–'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.status === 'beendet' ? 'default' : m.status === 'abgesagt' ? 'destructive' : 'secondary'}>
                      {STATUS_LABELS[m.status] ?? m.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: PINs & Codes
// ═══════════════════════════════════════════════════════════════════════════════

function PinsCodesTab() {
  const [search, setSearch] = useState('');

  const { data: matches, isLoading } = useQuery({
    queryKey: ['admin-pins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_matches')
        .select('id, match_day, match_date, home_team, away_team, pin, code, teams(name)')
        .order('match_date');
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!matches) return [];
    if (!search) return matches;
    const s = search.toLowerCase();
    return matches.filter((m: any) =>
      [m.home_team, m.away_team, m.pin, m.code, m.teams?.name].some((f) => (f ?? '').toLowerCase().includes(s))
    );
  }, [matches, search]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('In Zwischenablage kopiert');
  };

  if (isLoading) return <LoadingSkeleton />;

  const withPinOrCode = filtered.filter((m: any) => m.pin || m.code);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Spiel, PIN oder Code suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Spiele mit PIN</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{matches?.filter((m: any) => m.pin).length ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Spiele mit Code</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{matches?.filter((m: any) => m.code).length ?? 0}</p></CardContent>
        </Card>
      </div>

      {!withPinOrCode.length ? (
        <EmptyState icon={KeyRound} title="Keine PINs/Codes" description="Es sind keine Spiele mit PIN oder Code hinterlegt." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ST</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Mannschaft</TableHead>
                <TableHead>Begegnung</TableHead>
                <TableHead>PIN</TableHead>
                <TableHead>Code</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withPinOrCode.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm">{m.match_day ?? '–'}</TableCell>
                  <TableCell className="text-sm">{fmtDate(m.match_date)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.teams?.name ?? '–'}</TableCell>
                  <TableCell className="text-sm font-medium">{m.home_team} – {m.away_team}</TableCell>
                  <TableCell>
                    {m.pin ? (
                      <Button variant="ghost" size="sm" className="font-mono gap-1.5" onClick={() => copyToClipboard(m.pin!)}>
                        {m.pin} <Copy className="h-3 w-3" />
                      </Button>
                    ) : <span className="text-muted-foreground text-sm">–</span>}
                  </TableCell>
                  <TableCell>
                    {m.code ? (
                      <Button variant="ghost" size="sm" className="font-mono gap-1.5" onClick={() => copyToClipboard(m.code!)}>
                        {m.code} <Copy className="h-3 w-3" />
                      </Button>
                    ) : <span className="text-muted-foreground text-sm">–</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 5: Backup
// ═══════════════════════════════════════════════════════════════════════════════

function BackupTab() {
  const [exporting, setExporting] = useState<string | null>(null);

  const exportTable = async (tableName: string, label: string) => {
    setExporting(tableName);
    try {
      const { data, error } = await supabase.from(tableName as any).select('*');
      if (error) throw error;
      if (!data?.length) {
        toast.info(`Keine Daten in "${label}"`);
        setExporting(null);
        return;
      }

      const columns = Object.keys(data[0]).map((key) => ({
        key,
        label: key,
      }));

      const doc: ExportDocument = {
        filename: `backup_${tableName}_${new Date().toISOString().slice(0, 10)}`,
        title: `Backup: ${label}`,
        generatedAt: new Date().toISOString(),
        sections: [
          {
            type: 'table',
            columns,
            rows: data as Record<string, any>[],
          },
        ],
      };

      const blob = await csvAdapter.render(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${tableName}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${label} exportiert`);
    } catch {
      toast.error(`Fehler beim Export von "${label}"`);
    } finally {
      setExporting(null);
    }
  };

  const EXPORT_TABLES = [
    { key: 'members', label: 'Mitglieder' },
    { key: 'teams', label: 'Mannschaften' },
    { key: 'team_members', label: 'Mannschaftszuordnungen' },
    { key: 'schedule_matches', label: 'Spielplan' },
    { key: 'seasons', label: 'Saisons' },
    { key: 'venues', label: 'Spielorte' },
    { key: 'news', label: 'News' },
    { key: 'documents', label: 'Dokumente' },
    { key: 'meetings', label: 'Sitzungen' },
    { key: 'training_bookings', label: 'Trainingsbuchungen' },
    { key: 'communication_lists', label: 'Kommunikationslisten' },
  ];

  const exportAll = async () => {
    setExporting('all');
    for (const t of EXPORT_TABLES) {
      await exportTable(t.key, t.label);
    }
    setExporting(null);
    toast.success('Alle Tabellen exportiert');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Exportiere Vereinsdaten als CSV-Dateien für ein lokales Backup.
        </p>
        <Button onClick={exportAll} disabled={!!exporting}>
          <Download className="mr-2 h-4 w-4" />
          {exporting === 'all' ? 'Exportiert…' : 'Alle exportieren'}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {EXPORT_TABLES.map((t) => (
          <Card key={t.key}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-sm">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.key}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportTable(t.key, t.label)}
                disabled={!!exporting}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 6: Löschanfragen
// ═══════════════════════════════════════════════════════════════════════════════

function DeleteRequestsTab() {
  const queryClient = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmType, setConfirmType] = useState<'member' | 'team' | null>(null);

  // Show inactive members (exit_date set) as potential delete candidates
  const { data: inactiveMembers, isLoading: loadingMembers } = useQuery({
    queryKey: ['admin-inactive-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('is_active', false)
        .not('exit_date', 'is', null)
        .order('exit_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Inactive teams
  const { data: inactiveTeams, isLoading: loadingTeams } = useQuery({
    queryKey: ['admin-inactive-teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('is_active', false)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-inactive-members'] });
      queryClient.invalidateQueries({ queryKey: ['admin-members'] });
      toast.success('Mitglied gelöscht');
    },
    onError: () => toast.error('Fehler beim Löschen'),
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teams').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-inactive-teams'] });
      queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
      toast.success('Mannschaft gelöscht');
    },
    onError: () => toast.error('Fehler beim Löschen'),
  });

  const handleConfirmDelete = () => {
    if (!confirmId || !confirmType) return;
    if (confirmType === 'member') deleteMemberMutation.mutate(confirmId);
    else deleteTeamMutation.mutate(confirmId);
    setConfirmId(null);
    setConfirmType(null);
  };

  if (loadingMembers || loadingTeams) return <LoadingSkeleton />;

  const hasItems = (inactiveMembers?.length ?? 0) > 0 || (inactiveTeams?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {!hasItems ? (
        <EmptyState
          icon={CheckCircle2}
          title="Keine Löschanfragen"
          description="Es gibt keine inaktiven Mitglieder oder Mannschaften zum Löschen."
        />
      ) : (
        <>
          {(inactiveMembers?.length ?? 0) > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Inaktive Mitglieder ({inactiveMembers!.length})
              </h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>E-Mail</TableHead>
                      <TableHead>Austritt</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inactiveMembers!.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.first_name} {m.last_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.email ?? '–'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.exit_date ? fmtDate(m.exit_date) : '–'}</TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { setConfirmId(m.id); setConfirmType('member'); }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {(inactiveTeams?.length ?? 0) > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Inaktive Mannschaften ({inactiveTeams!.length})
              </h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Liga</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inactiveTeams!.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.league ?? '–'}</TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { setConfirmId(t.id); setConfirmType('team'); }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </>
      )}

      <AlertDialog open={!!confirmId} onOpenChange={(o) => { if (!o) { setConfirmId(null); setConfirmType(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmType === 'member'
                ? 'Das Mitglied und alle zugehörigen Daten werden unwiderruflich gelöscht.'
                : 'Die Mannschaft und alle Zuordnungen werden unwiderruflich gelöscht.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function Admin() {
  const [params, setParams] = useSearchParams();
  const activeTab = params.get('tab') ?? 'mitglieder';

  const handleTabChange = (value: string) => {
    setParams({ tab: value }, { replace: true });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Administration</h1>
        <p className="page-description">Zentrale Verwaltung aller Vereinsdaten</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="gap-1.5">
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="mitglieder" className="mt-6"><MembersAdminTab /></TabsContent>
        <TabsContent value="mannschaften" className="mt-6"><TeamsAdminTab /></TabsContent>
        <TabsContent value="spielplan" className="mt-6"><ScheduleAdminTab /></TabsContent>
        <TabsContent value="pins" className="mt-6"><PinsCodesTab /></TabsContent>
        <TabsContent value="backup" className="mt-6"><BackupTab /></TabsContent>
        <TabsContent value="loeschanfragen" className="mt-6"><DeleteRequestsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
