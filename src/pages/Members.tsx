import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search, Pencil, Trash2, Eye, X, UserPlus, FileDown } from 'lucide-react';
import { memberService } from '@/services/memberService';
import { useAuth } from '@/contexts/AuthContext';
import { canWriteMembers, canDeleteMembers } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { Constants } from '@/integrations/supabase/types';
import { getAgeGroupLabel, getGenderLabel } from '@/constants/uiLabels';
import type { MemberUI, MemberCreateDTO } from '@/types/member';

const emptyForm = {
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

type FormState = typeof emptyForm;

function memberToForm(m: MemberUI): FormState {
  return {
    first_name: m.firstName,
    last_name: m.lastName,
    email: m.email ?? '',
    phone: m.phone ?? '',
    date_of_birth: '',
    gender: '',
    street: m.street ?? '',
    zip_code: m.zipCode ?? '',
    city: m.city ?? '',
    member_number: m.memberNumber ?? '',
    age_group: m.ageGroup ?? '',
    ttr_rating: m.ttr?.toString() ?? '',
    qttr_rating: m.qttr?.toString() ?? '',
    entry_date: m.entryDate ?? new Date().toISOString().slice(0, 10),
    notes: '',
    is_active: m.isActive,
  };
}

function formToPayload(f: FormState): MemberCreateDTO {
  return {
    first_name: f.first_name.trim(),
    last_name: f.last_name.trim(),
    email: f.email.trim() || null,
    phone: f.phone.trim() || null,
    date_of_birth: f.date_of_birth || null,
    gender: (f.gender || null) as MemberCreateDTO['gender'],
    street: f.street.trim() || null,
    zip_code: f.zip_code.trim() || null,
    city: f.city.trim() || null,
    member_number: f.member_number.trim() || null,
    age_group: (f.age_group || null) as MemberCreateDTO['age_group'],
    ttr_rating: f.ttr_rating ? parseInt(f.ttr_rating, 10) : null,
    qttr_rating: f.qttr_rating ? parseInt(f.qttr_rating, 10) : null,
    entry_date: f.entry_date || undefined,
    is_active: f.is_active,
  };
}

// ─── PDF Helpers ──────────────────────────────────────────────────────────────

const PDF_STYLE = `
  body { font-family: system-ui, Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 16px; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  p.sub { font-size: 10px; color: #666; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f3f4f6; text-align: left; padding: 5px 8px; border-bottom: 2px solid #d1d5db; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; background: #e0e7ff; color: #3730a3; margin-right: 3px; }
  .sec { margin-top: 14px; }
  .sec-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin-bottom: 6px; }
  .row { display: grid; grid-template-columns: 140px 1fr; gap: 2px 8px; margin-bottom: 3px; }
  .lbl { color: #6b7280; }
  @media print { @page { margin: 1.5cm; } body { padding: 0; } }
`;

function fmtIso(iso: string | null | undefined): string {
  if (!iso) return '–';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function printCompactOverview(
  members: import('@/types/member').MemberUI[],
  rolesMap: Map<string, string[]>,
  title = 'Mitglieder – Kompaktübersicht',
) {
  const now = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const rows = members.map((m) => {
    const roles = (rolesMap.get(m.id) ?? []).join(', ') || '–';
    return `<tr>
      <td>${m.memberNumber ?? '–'}</td>
      <td>${m.lastName}, ${m.firstName}</td>
      <td>${m.email ?? '–'}</td>
      <td>${m.phone ?? m.mobile ?? '–'}</td>
      <td>${m.isActive ? 'Aktiv' : 'Inaktiv'}</td>
      <td>${roles}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
    <title>${title}</title><style>${PDF_STYLE}</style></head><body>
    <h1>${title}</h1>
    <p class="sub">Stand: ${now} · ${members.length} Mitglied${members.length !== 1 ? 'er' : ''}</p>
    <table>
      <thead><tr>
        <th>Nr.</th><th>Name</th><th>E-Mail</th><th>Telefon</th><th>Status</th><th>Rollen</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

function printMemberProfile(
  m: import('@/types/member').MemberUI,
  roles: string[],
  teams: { name: string; position: number | null }[],
) {
  const now = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const field = (label: string, value: string | null | undefined) =>
    `<div class="row"><span class="lbl">${label}</span><span>${value ?? '–'}</span></div>`;

  const teamsHtml = teams.length
    ? teams.map((t) => `<div class="row"><span class="lbl">Position ${t.position ?? '–'}</span><span>${t.name}</span></div>`).join('')
    : '<div class="row"><span class="lbl">–</span><span>Keine Mannschaften</span></div>';

  const rolesHtml = roles.length
    ? roles.map((r) => `<span class="badge">${r}</span>`).join('')
    : '–';

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
    <title>Profil – ${m.firstName} ${m.lastName}</title><style>${PDF_STYLE}</style></head><body>
    <h1>Mitgliedsprofil</h1>
    <p class="sub">Erstellt am ${now}</p>

    <div class="sec">
      <div class="sec-title">Persönliche Daten</div>
      ${field('Nachname', m.lastName)}
      ${field('Vorname', m.firstName)}
      ${field('Mitgliedsnr.', m.memberNumber)}
      ${field('Geburtsdatum', fmtIso(m.birthdate))}
    </div>

    <div class="sec">
      <div class="sec-title">Kontakt</div>
      ${field('E-Mail', m.email)}
      ${field('Telefon', m.phone)}
      ${field('Mobil', m.mobile)}
      ${field('Straße', m.street)}
      ${field('PLZ / Ort', [m.zipCode, m.city].filter(Boolean).join(' ') || null)}
    </div>

    <div class="sec">
      <div class="sec-title">Mitgliedschaft</div>
      ${field('Eintritt', fmtIso(m.entryDate))}
      ${field('Austritt', fmtIso(m.exitDate))}
      ${field('Status', m.isActive ? 'Aktiv' : 'Inaktiv')}
      ${field('Altersgruppe', m.ageGroup ?? null)}
    </div>

    <div class="sec">
      <div class="sec-title">Spielstärke</div>
      ${field('TTR', m.ttr?.toString() ?? null)}
      ${field('QTTR', m.qttr?.toString() ?? null)}
    </div>

    <div class="sec">
      <div class="sec-title">Rollen</div>
      <div class="row"><span class="lbl">Systemrollen</span><span>${rolesHtml}</span></div>
    </div>

    <div class="sec">
      <div class="sec-title">Mannschaften</div>
      ${teamsHtml}
    </div>
  </body></html>`;

  const w = window.open('', '_blank', 'width=800,height=700');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

export default function Members() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const canWrite = canWriteMembers(role);
  const canDelete = canDeleteMembers(role);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<MemberUI | null>(null);
  const [viewingMember, setViewingMember] = useState<MemberUI | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: members = [], isLoading } = useQuery<MemberUI[]>({
    queryKey: ['members'],
    queryFn: () => memberService.list(),
  });

  const { data: memberRolesData = [] } = useQuery({
    queryKey: ['member_roles_all'],
    queryFn: async () => {
      const { data, error } = await (await import('@/integrations/supabase/client')).supabase
        .from('member_roles')
        .select('member_id, role');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team_members_all'],
    queryFn: async () => {
      const { data, error } = await (await import('@/integrations/supabase/client')).supabase
        .from('team_members')
        .select('member_id, team_id, position, teams(name)');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allRoles = [] } = useQuery({
    queryKey: ['roles_all'],
    queryFn: async () => {
      const { data, error } = await (await import('@/integrations/supabase/client')).supabase
        .from('roles')
        .select('name, display_name')
        .order('display_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allTeams = [] } = useQuery({
    queryKey: ['teams_all_edit'],
    queryFn: async () => {
      const { data, error } = await (await import('@/integrations/supabase/client')).supabase
        .from('teams')
        .select('id, name, age_group, league, season_phases(name)')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['members'] });

  const createMut = useMutation({
    mutationFn: (m: MemberCreateDTO) => memberService.create(m),
    onSuccess: () => { toast.success('Mitglied erstellt'); invalidate(); closeForm(); },
    onError: (e: any) => {
      if (e?.code === '23505') {
        toast.error('Diese Position ist in der Mannschaft bereits vergeben.');
        return;
      }
      if (e?.code === '23514') {
        toast.error('Position muss eine positive ganze Zahl sein.');
        return;
      }
      toast.error(e.message);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MemberCreateDTO> }) =>
      memberService.update(id, data),
    onSuccess: () => { toast.success('Mitglied aktualisiert'); invalidate(); closeForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => memberService.remove(id),
    onSuccess: () => { toast.success('Mitglied gelöscht'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      memberService.update(id, { is_active: active }),
    onSuccess: () => { toast.success('Status aktualisiert'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const canEditAssignments = role === 'admin' || role === 'developer' || role === 'vorstand';

  const toggleRoleMut = useMutation({
    mutationFn: async ({ memberId, roleName, active }: { memberId: string; roleName: string; active: boolean }) => {
      const { supabase } = await import('@/integrations/supabase/client');
      if (active) {
        const { error } = await supabase.from('member_roles').insert({ member_id: memberId, role: roleName });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('member_roles').delete().eq('member_id', memberId).eq('role', roleName);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success('Rolle aktualisiert'); queryClient.invalidateQueries({ queryKey: ['member_roles_all'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTeamMut = useMutation({
    mutationFn: async ({ memberId, teamId, active }: { memberId: string; teamId: string; active: boolean }) => {
      const { supabase } = await import('@/integrations/supabase/client');
      if (active) {
        const { data: existingRows, error: existingError } = await supabase
          .from('team_members')
          .select('position')
          .eq('team_id', teamId);
        if (existingError) throw existingError;

        const used = new Set((existingRows ?? []).map((r) => r.position).filter((p) => Number.isInteger(p) && p > 0));
        let nextPosition = 1;
        while (used.has(nextPosition)) nextPosition += 1;

        const { error } = await supabase.from('team_members').insert({
          member_id: memberId,
          team_id: teamId,
          position: nextPosition,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('team_members').delete().eq('member_id', memberId).eq('team_id', teamId);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success('Mannschaftszuordnung aktualisiert'); queryClient.invalidateQueries({ queryKey: ['team_members_all'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = members.filter((m: MemberUI) => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      m.firstName.toLowerCase().includes(q) ||
      m.lastName.toLowerCase().includes(q) ||
      (m.email?.toLowerCase().includes(q)) ||
      (m.memberNumber?.toLowerCase().includes(q));
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && m.isActive) ||
      (statusFilter === 'inactive' && !m.isActive);
    return matchesSearch && matchesStatus;
  });

  const rolesMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of memberRolesData) {
      const existing = m.get(r.member_id) ?? [];
      m.set(r.member_id, [...existing, r.role]);
    }
    return m;
  }, [memberRolesData]);

  function getTeamsForMember(memberId: string) {
    return teamMembers
      .filter((tm) => tm.member_id === memberId)
      .map((tm) => ({
        name: (tm.teams as any)?.name ?? 'Unbekannt',
        position: tm.position,
      }));
  }

  function getRolesForMember(m: MemberUI): string[] {
    return memberRolesData
      .filter((r) => r.member_id === m.id)
      .map((r) => r.role);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingMember(null);
    setForm(emptyForm);
    setErrors({});
  }

  function openCreate() {
    setEditingMember(null);
    setForm(emptyForm);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(m: MemberUI) {
    setEditingMember(m);
    setForm(memberToForm(m));
    setErrors({});
    setFormOpen(true);
  }

  function openDetail(m: MemberUI) {
    setViewingMember(m);
    setDetailOpen(true);
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
    const payload = formToPayload(form);
    if (editingMember) {
      updateMut.mutate({ id: editingMember.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  function setField(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="page-header">
          <h1 className="page-title">Mitgliederverwaltung</h1>
          <p className="page-description">
            {members.length} Mitglied{members.length !== 1 ? 'er' : ''} insgesamt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => printCompactOverview(filtered, rolesMap)}
            disabled={filtered.length === 0}
          >
            <FileDown className="mr-2 h-4 w-4" /> Kompakt PDF
          </Button>
          {canWrite && (
            <Button onClick={openCreate}>
              <UserPlus className="mr-2 h-4 w-4" /> Mitglied hinzufügen
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Name, E-Mail oder Mitgliedsnummer suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              type="button"
              aria-label="Suche zurücksetzen"
              title="Suche zurücksetzen"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="active">Aktiv</SelectItem>
            <SelectItem value="inactive">Inaktiv</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Laden…</div>
      ) : filtered.length === 0 ? (
        search || statusFilter !== 'all' ? (
          <div className="text-center py-12 text-muted-foreground">Keine Mitglieder gefunden.</div>
        ) : (
          <EmptyState
            icon={Users}
            title="Keine Mitglieder"
            description="Füge dein erstes Vereinsmitglied hinzu."
            actionLabel={canWrite ? 'Mitglied hinzufügen' : undefined}
            onAction={canWrite ? openCreate : undefined}
          />
        )
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">E-Mail</TableHead>
                <TableHead className="hidden lg:table-cell">Mitgliedsnr.</TableHead>
                <TableHead className="hidden lg:table-cell">TTR / QTTR</TableHead>
                <TableHead className="hidden md:table-cell">Rollen</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m: MemberUI) => {
                const roles = getRolesForMember(m);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {m.lastName}, {m.firstName}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {m.email ?? '–'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {m.memberNumber ?? '–'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {m.ttr ?? '–'} / {m.qttr ?? '–'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {roles.length > 0 ? roles.map((r) => (
                          <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                        )) : (
                          <span className="text-muted-foreground text-xs">–</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {canWrite ? (
                        <Switch
                          checked={m.isActive}
                          onCheckedChange={(val) => toggleMut.mutate({ id: m.id, active: val })}
                        />
                      ) : (
                        <Badge variant={m.isActive ? 'default' : 'secondary'}>
                          {m.isActive ? 'Aktiv' : 'Inaktiv'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openDetail(m)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canWrite && (
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(m.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={(o) => !o && setDetailOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {viewingMember ? `${viewingMember.firstName} ${viewingMember.lastName}` : 'Mitglied'}
            </DialogTitle>
          </DialogHeader>
          {viewingMember && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm py-2">
              <DetailRow label="Mitgliedsnr." value={viewingMember.memberNumber} />
              <DetailRow label="E-Mail" value={viewingMember.email} />
              <DetailRow label="Telefon" value={viewingMember.phone} />
              <DetailRow label="TTR" value={viewingMember.ttr?.toString()} />
              <DetailRow label="QTTR" value={viewingMember.qttr?.toString()} />
              <DetailRow label="Altersgruppe" value={viewingMember.ageGroup ? getAgeGroupLabel(viewingMember.ageGroup) : null} />
              <DetailRow label="Straße" value={viewingMember.street} />
              <DetailRow label="PLZ / Ort" value={[viewingMember.zipCode, viewingMember.city].filter(Boolean).join(' ') || null} />
              <DetailRow label="Eintrittsdatum" value={viewingMember.entryDate} />
              <DetailRow label="Austrittsdatum" value={viewingMember.exitDate} />
              <DetailRow label="Status" value={viewingMember.isActive ? 'Aktiv' : 'Inaktiv'} />
              <DetailRow label="Rollen" value={getRolesForMember(viewingMember).join(', ') || null} />
              {viewingMember.userId && (
                <DetailRow label="User-ID" value={viewingMember.userId} />
              )}
            </div>
          )}
          <DialogFooter>
            {viewingMember && (
              <Button
                variant="outline"
                onClick={() =>
                  printMemberProfile(
                    viewingMember,
                    getRolesForMember(viewingMember),
                    getTeamsForMember(viewingMember.id),
                  )
                }
              >
                <FileDown className="mr-2 h-4 w-4" /> Als PDF
              </Button>
            )}
            {canWrite && viewingMember && (
              <Button variant="outline" onClick={() => { setDetailOpen(false); openEdit(viewingMember); }}>
                <Pencil className="mr-2 h-4 w-4" /> Bearbeiten
              </Button>
            )}
            <Button onClick={() => setDetailOpen(false)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Form Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => !o && closeForm()}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMember ? 'Mitglied bearbeiten' : 'Neues Mitglied'}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="profil" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profil">Profil</TabsTrigger>
              <TabsTrigger value="rollen" disabled={!editingMember}>Rollen</TabsTrigger>
              <TabsTrigger value="teams" disabled={!editingMember}>Teams</TabsTrigger>
              <TabsTrigger value="passwort" disabled={!editingMember}>Passwort</TabsTrigger>
            </TabsList>

            {/* Tab: Profil */}
            <TabsContent value="profil" className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Vorname *" id="first_name" value={form.first_name} error={errors.first_name}
                  onChange={(v) => setField('first_name', v)} />
                <FormField label="Nachname *" id="last_name" value={form.last_name} error={errors.last_name}
                  onChange={(v) => setField('last_name', v)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="E-Mail" id="email" value={form.email} error={errors.email} type="email"
                  onChange={(v) => setField('email', v)} />
                <FormField label="Telefon" id="phone" value={form.phone}
                  onChange={(v) => setField('phone', v)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Geburtsdatum" id="date_of_birth" value={form.date_of_birth} type="date"
                  onChange={(v) => setField('date_of_birth', v)} />
                <div className="space-y-1.5">
                  <Label htmlFor="gender">Geschlecht</Label>
                  <Select value={form.gender} onValueChange={(v) => setField('gender', v)}>
                    <SelectTrigger id="gender"><SelectValue placeholder="Auswählen" /></SelectTrigger>
                    <SelectContent>
                      {Constants.public.Enums.gender.map((g) => (
                        <SelectItem key={g} value={g}>{getGenderLabel(g)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <FormField label="Straße" id="street" value={form.street}
                onChange={(v) => setField('street', v)} />
              <div className="grid grid-cols-3 gap-4">
                <FormField label="PLZ" id="zip_code" value={form.zip_code}
                  onChange={(v) => setField('zip_code', v)} />
                <div className="col-span-2">
                  <FormField label="Ort" id="city" value={form.city}
                    onChange={(v) => setField('city', v)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Mitgliedsnummer" id="member_number" value={form.member_number}
                  onChange={(v) => setField('member_number', v)} />
                <div className="space-y-1.5">
                  <Label htmlFor="age_group">Altersgruppe</Label>
                  <Select value={form.age_group} onValueChange={(v) => setField('age_group', v)}>
                    <SelectTrigger id="age_group"><SelectValue placeholder="Auswählen" /></SelectTrigger>
                    <SelectContent>
                      {Constants.public.Enums.age_group.map((ag) => (
                        <SelectItem key={ag} value={ag}>{getAgeGroupLabel(ag)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="TTR-Wert" id="ttr_rating" value={form.ttr_rating} error={errors.ttr_rating}
                  type="number" onChange={(v) => setField('ttr_rating', v)} />
                <FormField label="QTTR-Wert" id="qttr_rating" value={form.qttr_rating} error={errors.qttr_rating}
                  type="number" onChange={(v) => setField('qttr_rating', v)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Eintrittsdatum *" id="entry_date" value={form.entry_date} error={errors.entry_date}
                  type="date" onChange={(v) => setField('entry_date', v)} />
                {editingMember && (
                  <FormField label="Austrittsdatum" id="exit_date" value={editingMember.exitDate ?? ''} type="date"
                    onChange={() => {}} />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notizen</Label>
                <Textarea id="notes" value={form.notes} onChange={(e) => setField('notes', e.target.value)}
                  rows={3} placeholder="Optionale Anmerkungen…" />
              </div>
              <div className="flex items-center gap-3">
                <Switch id="is_active" checked={form.is_active}
                  onCheckedChange={(v) => setField('is_active', v)} />
                <Label htmlFor="is_active">Aktives Mitglied</Label>
              </div>
            </TabsContent>

            {/* Tab: Rollen */}
            <TabsContent value="rollen" className="space-y-4 pt-2">
              {editingMember && (() => {
                const memberRoles = getRolesForMember(editingMember);
                return (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Berechtigungen dem Profil zuweisen</p>
                    <div className="space-y-2">
                      {allRoles.map((r) => (
                        <div key={r.name} className="flex items-center justify-between">
                          <span className="text-sm">{r.display_name}</span>
                          <Switch
                            checked={memberRoles.includes(r.name)}
                            disabled={!canEditAssignments}
                            onCheckedChange={(checked) => {
                              if (canEditAssignments) {
                                toggleRoleMut.mutate({ memberId: editingMember.id, roleName: r.name, active: checked });
                              }
                            }}
                          />
                        </div>
                      ))}
                      {allRoles.length === 0 && (
                        <span className="text-sm text-muted-foreground">Keine Rollen definiert</span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </TabsContent>

            {/* Tab: Teams */}
            <TabsContent value="teams" className="space-y-4 pt-2">
              {editingMember && (() => {
                const JUGEND_GROUPS = new Set(['jungen_18','maedchen_18','jungen_15','maedchen_15','jungen_13','maedchen_13','jungen_11','maedchen_11']);
                const memberTeamIds = new Set(
                  teamMembers.filter((tm) => tm.member_id === editingMember.id).map((tm) => tm.team_id)
                );
                const erwachseneTeams = allTeams.filter((t) => !JUGEND_GROUPS.has(t.age_group));
                const jugendTeams = allTeams.filter((t) => JUGEND_GROUPS.has(t.age_group));

                return (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Mannschaften dem Profil zuweisen</p>

                    {erwachseneTeams.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">Erwachsene</p>
                        {erwachseneTeams.map((t) => (
                          <div key={t.id} className="flex items-center justify-between">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{t.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {t.age_group ? getAgeGroupLabel(t.age_group) : ''} {t.league ?? ''} {(t.season_phases as any)?.name ? (t.season_phases as any).name : ''}
                              </p>
                            </div>
                            <Switch
                              checked={memberTeamIds.has(t.id)}
                              disabled={!canEditAssignments}
                              onCheckedChange={(checked) => {
                                if (canEditAssignments) {
                                  toggleTeamMut.mutate({ memberId: editingMember.id, teamId: t.id, active: checked });
                                }
                              }}
                              className="shrink-0 ml-2"
                            />
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
                                {t.age_group ? getAgeGroupLabel(t.age_group) : ''} {t.league ?? ''} {(t.season_phases as any)?.name ? (t.season_phases as any).name : ''}
                              </p>
                            </div>
                            <Switch
                              checked={memberTeamIds.has(t.id)}
                              disabled={!canEditAssignments}
                              onCheckedChange={(checked) => {
                                if (canEditAssignments) {
                                  toggleTeamMut.mutate({ memberId: editingMember.id, teamId: t.id, active: checked });
                                }
                              }}
                              className="shrink-0 ml-2"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {allTeams.length === 0 && (
                      <span className="text-sm text-muted-foreground">Keine Mannschaften angelegt</span>
                    )}
                  </div>
                );
              })()}
            </TabsContent>

            {/* Tab: Passwort */}
            <TabsContent value="passwort" className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Passwort-Verwaltung ist über die persönlichen Sicherheitseinstellungen des jeweiligen Nutzers möglich.
              </p>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Abbrechen</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {editingMember ? 'Speichern' : 'Erstellen'}
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
              Das Mitglied wird unwiderruflich entfernt. Verknüpfte Mannschaftszuweisungen bleiben davon unberührt.
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

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span>{value || '–'}</span>
    </>
  );
}

function FormField({
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
