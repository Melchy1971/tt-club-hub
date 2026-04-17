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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Constants } from '@/integrations/supabase/types';
import { getAgeGroupLabel, getGenderLabel } from '@/constants/uiLabels';
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
import { MATCH_STATUS_LABELS_DE, getMatchStatusLabel } from '@/constants/uiLabels';

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
// TAB 1: Mitglieder (CRUD)
// ═══════════════════════════════════════════════════════════════════════════════

const emptyMemberForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  gender: '' as string,
  street: '',
  zip_code: '',
  city: '',
  member_number: '',
  age_group: '' as string,
  ttr_rating: '',
  qttr_rating: '',
  entry_date: new Date().toISOString().slice(0, 10),
  notes: '',
  is_active: true,
};

type MemberFormState = typeof emptyMemberForm;

const JUGEND_GROUPS = new Set(['jungen_18','maedchen_18','jungen_15','maedchen_15','jungen_13','maedchen_13','jungen_11','maedchen_11']);

function MembersAdminTab() {
  const { role: currentRole } = useAuth();
  const canEditAssignments = currentRole === 'admin' || currentRole === 'developer' || currentRole === 'vorstand';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberFormState>(emptyMemberForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

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

  const { data: userRoles = [] } = useQuery({
    queryKey: ['admin-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('user_id, role');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['admin-team-members'],
    queryFn: async () => {
      const { data, error } = await supabase.from('team_members').select('member_id, team_id');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allRoles = [] } = useQuery({
    queryKey: ['admin-roles-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('roles').select('name, display_name').order('display_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allTeams = [] } = useQuery({
    queryKey: ['admin-teams-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('teams').select('id, name, age_group, league, season_phases(name)').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const { error } = await supabase.from('members').insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Mitglied erstellt'); queryClient.invalidateQueries({ queryKey: ['admin-members'] }); closeForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const { error } = await supabase.from('members').update(data as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Mitglied aktualisiert'); queryClient.invalidateQueries({ queryKey: ['admin-members'] }); closeForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Mitglied gelöscht'); queryClient.invalidateQueries({ queryKey: ['admin-members'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleRoleMut = useMutation({
    mutationFn: async ({ userId, roleName, active }: { userId: string; roleName: string; active: boolean }) => {
      if (active) {
        const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: roleName as any });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', roleName as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success('Rolle aktualisiert'); queryClient.invalidateQueries({ queryKey: ['admin-user-roles'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTeamMut = useMutation({
    mutationFn: async ({ memberId, teamId, active }: { memberId: string; teamId: string; active: boolean }) => {
      if (active) {
        const { error } = await supabase.from('team_members').insert({ member_id: memberId, team_id: teamId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('team_members').delete().eq('member_id', memberId).eq('team_id', teamId);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success('Mannschaftszuordnung aktualisiert'); queryClient.invalidateQueries({ queryKey: ['admin-team-members'] }); },
    onError: (e: Error) => toast.error(e.message),
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

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setEditingUserId(null);
    setForm(emptyMemberForm);
    setErrors({});
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyMemberForm);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(m: any) {
    setEditingId(m.id);
    setEditingUserId(m.user_id ?? null);
    setForm({
      first_name: m.first_name ?? '',
      last_name: m.last_name ?? '',
      email: m.email ?? '',
      phone: m.phone ?? '',
      date_of_birth: m.date_of_birth ?? '',
      gender: m.gender ?? '',
      street: m.street ?? '',
      zip_code: m.zip_code ?? '',
      city: m.city ?? '',
      member_number: m.member_number ?? '',
      age_group: m.age_group ?? '',
      ttr_rating: m.ttr_rating?.toString() ?? '',
      qttr_rating: m.qttr_rating?.toString() ?? '',
      entry_date: m.entry_date ?? new Date().toISOString().slice(0, 10),
      notes: m.notes ?? '',
      is_active: m.is_active,
    });
    setErrors({});
    setFormOpen(true);
  }

  function setField(field: keyof MemberFormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = 'Vorname ist erforderlich';
    if (!form.last_name.trim()) e.last_name = 'Nachname ist erforderlich';
    if (!form.entry_date) e.entry_date = 'Eintrittsdatum ist erforderlich';
    if (form.ttr_rating && isNaN(parseInt(form.ttr_rating, 10))) e.ttr_rating = 'Ungültige Zahl';
    if (form.qttr_rating && isNaN(parseInt(form.qttr_rating, 10))) e.qttr_rating = 'Ungültige Zahl';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Ungültige E-Mail';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    const payload: Record<string, any> = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      street: form.street.trim() || null,
      zip_code: form.zip_code.trim() || null,
      city: form.city.trim() || null,
      member_number: form.member_number.trim() || null,
      age_group: form.age_group || null,
      ttr_rating: form.ttr_rating ? parseInt(form.ttr_rating, 10) : null,
      qttr_rating: form.qttr_rating ? parseInt(form.qttr_rating, 10) : null,
      entry_date: form.entry_date,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    };
    if (editingId) {
      updateMut.mutate({ id: editingId, data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

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
        <Button onClick={openCreate}>
          <UserPlus className="mr-2 h-4 w-4" /> Mitglied hinzufügen
        </Button>
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
                <TableHead className="text-right">Aktionen</TableHead>
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
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(m.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit Form Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => !o && closeForm()}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Mitglied bearbeiten' : 'Neues Mitglied'}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="stammdaten" className="py-2">
            {editingId && (
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="stammdaten">Stammdaten</TabsTrigger>
                <TabsTrigger value="rollen">Rollen</TabsTrigger>
                <TabsTrigger value="mannschaften">Mannschaften</TabsTrigger>
              </TabsList>
            )}

            <TabsContent value="stammdaten" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <AdminFormField label="Vorname *" id="adm_first_name" value={form.first_name} error={errors.first_name}
                  onChange={(v) => setField('first_name', v)} />
                <AdminFormField label="Nachname *" id="adm_last_name" value={form.last_name} error={errors.last_name}
                  onChange={(v) => setField('last_name', v)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <AdminFormField label="E-Mail" id="adm_email" value={form.email} error={errors.email} type="email"
                  onChange={(v) => setField('email', v)} />
                <AdminFormField label="Telefon" id="adm_phone" value={form.phone}
                  onChange={(v) => setField('phone', v)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <AdminFormField label="Geburtsdatum" id="adm_dob" value={form.date_of_birth} type="date"
                  onChange={(v) => setField('date_of_birth', v)} />
                <div className="space-y-1.5">
                  <Label htmlFor="adm_gender">Geschlecht</Label>
                  <Select value={form.gender} onValueChange={(v) => setField('gender', v)}>
                    <SelectTrigger id="adm_gender"><SelectValue placeholder="Auswählen" /></SelectTrigger>
                    <SelectContent>
                      {Constants.public.Enums.gender.map((g) => (
                        <SelectItem key={g} value={g}>{getGenderLabel(g)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <AdminFormField label="Straße" id="adm_street" value={form.street}
                onChange={(v) => setField('street', v)} />
              <div className="grid grid-cols-3 gap-4">
                <AdminFormField label="PLZ" id="adm_zip" value={form.zip_code}
                  onChange={(v) => setField('zip_code', v)} />
                <div className="col-span-2">
                  <AdminFormField label="Ort" id="adm_city" value={form.city}
                    onChange={(v) => setField('city', v)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <AdminFormField label="Mitgliedsnummer" id="adm_member_nr" value={form.member_number}
                  onChange={(v) => setField('member_number', v)} />
                <div className="space-y-1.5">
                  <Label htmlFor="adm_age_group">Altersgruppe</Label>
                  <Select value={form.age_group} onValueChange={(v) => setField('age_group', v)}>
                    <SelectTrigger id="adm_age_group"><SelectValue placeholder="Auswählen" /></SelectTrigger>
                    <SelectContent>
                      {Constants.public.Enums.age_group.map((ag) => (
                        <SelectItem key={ag} value={ag}>{getAgeGroupLabel(ag)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <AdminFormField label="TTR-Wert" id="adm_ttr" value={form.ttr_rating} error={errors.ttr_rating}
                  type="number" onChange={(v) => setField('ttr_rating', v)} />
                <AdminFormField label="QTTR-Wert" id="adm_qttr" value={form.qttr_rating} error={errors.qttr_rating}
                  type="number" onChange={(v) => setField('qttr_rating', v)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <AdminFormField label="Eintrittsdatum *" id="adm_entry" value={form.entry_date} error={errors.entry_date}
                  type="date" onChange={(v) => setField('entry_date', v)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adm_notes">Notizen</Label>
                <Textarea id="adm_notes" value={form.notes} onChange={(e) => setField('notes', e.target.value)}
                  rows={3} placeholder="Optionale Anmerkungen…" />
              </div>
            </TabsContent>

            {editingId && (() => {
              const memberRoles = editingUserId
                ? userRoles.filter((r) => r.user_id === editingUserId).map((r) => r.role)
                : [];
              const memberTeamIds = new Set(
                teamMembers.filter((tm) => tm.member_id === editingId).map((tm) => tm.team_id)
              );
              const erwachseneTeams = allTeams.filter((t) => !JUGEND_GROUPS.has(t.age_group));
              const jugendTeams = allTeams.filter((t) => JUGEND_GROUPS.has(t.age_group));

              return (
                <>
                  <TabsContent value="rollen" className="space-y-4 mt-4">
                    <div>
                      <p className="text-base font-semibold">Rollen</p>
                      <p className="text-xs text-muted-foreground">Berechtigungen dem Profil zuweisen</p>
                    </div>
                    {!canEditAssignments && (
                      <p className="text-xs text-destructive">
                        Nur Administrator, Vorstand oder Entwickler dürfen Rollen ändern.
                      </p>
                    )}
                    {canEditAssignments && !editingUserId && (
                      <p className="text-xs text-muted-foreground">
                        Diesem Mitglied ist kein Benutzerkonto zugeordnet – Rollen können erst nach Verknüpfung vergeben werden.
                      </p>
                    )}
                    <div className="space-y-2">
                      {allRoles.map((r) => (
                        <div key={r.name} className="flex items-center justify-between">
                          <span className="text-sm">{r.display_name}</span>
                          <Switch checked={memberRoles.includes(r.name)} disabled={!canEditAssignments || !editingUserId} onCheckedChange={(checked) => { if (editingUserId) toggleRoleMut.mutate({ userId: editingUserId, roleName: r.name, active: checked }); }} />
                        </div>
                      ))}
                      {allRoles.length === 0 && (
                        <span className="text-sm text-muted-foreground">Keine Rollen definiert</span>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="mannschaften" className="space-y-4 mt-4">
                    <div>
                      <p className="text-base font-semibold">Mannschaften</p>
                      <p className="text-xs text-muted-foreground">Mannschaften dem Profil zuweisen</p>
                    </div>

                    {erwachseneTeams.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">Erwachsene</p>
                        {erwachseneTeams.map((t) => (
                          <div key={t.id} className="flex items-center justify-between">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{t.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {t.age_group ? getAgeGroupLabel(t.age_group) : ''} {t.league ?? ''} {(t.season_phases as any)?.name ?? ''}
                              </p>
                            </div>
                            <Switch checked={memberTeamIds.has(t.id)} disabled={!canEditAssignments} onCheckedChange={(checked) => { if (editingId) toggleTeamMut.mutate({ memberId: editingId, teamId: t.id, active: checked }); }} className="shrink-0 ml-2" />
                          </div>
                        ))}
                      </div>
                    )}

                    {jugendTeams.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">Jugend</p>
                        {jugendTeams.map((t) => (
                          <div key={t.id} className="flex items-center justify-between">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{t.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {t.age_group ? getAgeGroupLabel(t.age_group) : ''} {t.league ?? ''} {(t.season_phases as any)?.name ?? ''}
                              </p>
                            </div>
                            <Switch checked={memberTeamIds.has(t.id)} disabled={!canEditAssignments} onCheckedChange={(checked) => { if (editingId) toggleTeamMut.mutate({ memberId: editingId, teamId: t.id, active: checked }); }} className="shrink-0 ml-2" />
                          </div>
                        ))}
                      </div>
                    )}

                    {allTeams.length === 0 && (
                      <span className="text-sm text-muted-foreground">Keine Mannschaften angelegt</span>
                    )}
                  </TabsContent>
                </>
              );
            })()}
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Abbrechen</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {editingId ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mitglied löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Mitglied wird unwiderruflich entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) deleteMut.mutate(deleteId); setDeleteId(null); }}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AdminFormField({
  label, id, value, error, type = 'text', onChange,
}: {
  label: string; id: string; value: string; error?: string; type?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: Mannschaften (CRUD + Spielerzuordnung)
// ═══════════════════════════════════════════════════════════════════════════════

function TeamsAdminTab() {
  const [search, setSearch] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<any | null>(null);
  const [rosterDialogOpen, setRosterDialogOpen] = useState(false);
  const [rosterTeam, setRosterTeam] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const queryClient = useQueryClient();

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

  const saveMutation = useMutation({
    mutationFn: async ({ data, id }: { data: any; id?: string }) => {
      if (id) {
        const { error } = await supabase.from('teams').update({
          name: data.name,
          league: data.league || null,
          division: data.division || null,
          age_group: data.age_group,
          season_phase_id: data.season_phase_id || null,
          is_active: data.is_active,
        }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('teams').insert({
          name: data.name,
          league: data.league || null,
          division: data.division || null,
          age_group: data.age_group,
          season_phase_id: data.season_phase_id || null,
          is_active: data.is_active,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
      setEditDialogOpen(false);
      setEditTeam(null);
      toast.success(editTeam ? 'Mannschaft aktualisiert' : 'Mannschaft angelegt');
    },
    onError: () => toast.error('Fehler beim Speichern'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teams').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
      toast.success('Mannschaft gelöscht');
    },
    onError: () => toast.error('Fehler beim Löschen'),
  });

  const handleSave = (data: any, id?: string) => {
    saveMutation.mutate({ data, id });
  };

  const handleEdit = (team: any) => {
    setEditTeam(team);
    setEditDialogOpen(true);
  };

  const handleCreate = () => {
    setEditTeam(null);
    setEditDialogOpen(true);
  };

  const handleRoster = (team: any) => {
    setRosterTeam({ id: team.id, name: team.name });
    setRosterDialogOpen(true);
  };

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Mannschaft suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Neue Mannschaft
        </Button>
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
                <TableHead className="w-32">Aktionen</TableHead>
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
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleRoster(t)} title="Kader verwalten">
                        <UserPlus className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(t)} title="Bearbeiten">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteConfirmId(t.id)} title="Löschen">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TeamEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        team={editTeam}
        onSave={handleSave}
        saving={saveMutation.isPending}
      />

      <TeamRosterDialog
        open={rosterDialogOpen}
        onOpenChange={setRosterDialogOpen}
        team={rosterTeam}
      />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mannschaft löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Mannschaft und alle Spielerzuordnungen werden unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId) deleteMutation.mutate(deleteConfirmId);
                setDeleteConfirmId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
          {Object.entries(MATCH_STATUS_LABELS_DE).map(([k, v]) => (
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
                      {getMatchStatusLabel(m.status)}
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
