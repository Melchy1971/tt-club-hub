import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  Newspaper,
  FileText,
  Calendar,
  Mail,
  ListChecks,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Image,
  Download,
  LayoutDashboard,
  Phone,
  FileDown,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Member } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewsItem {
  id: string;
  title: string;
  content: string;
  is_published: boolean;
  published_at: string | null;
  image_url: string | null;
  author_id: string;
  created_at: string;
}

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time: string | null;
  location: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
}

interface MeetingDoc {
  id: string;
  meeting_id: string;
  title: string;
  file_url: string;
  uploaded_by: string;
  created_at: string;
}

interface CommList {
  id: string;
  name: string;
  description: string | null;
  list_type: string;
  created_at: string;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 rounded-md" />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: Mitglieder (alle, mit optionalem Vorstand-Filter + PDF-Export)
// ═══════════════════════════════════════════════════════════════════════════════

const ROLE_LABELS: Record<string, string> = {
  admin:           'Administrator',
  vorstand:        'Vorstand',
  trainer:         'Trainer',
  spieler:         'Spieler',
  mitglied:        'Mitglied',
  developer:       'Entwickler',
  foerdermitglied: 'Fördermitglied',
};

const ROLE_PRIORITY: Record<string, number> = {
  admin: 6, developer: 5, vorstand: 4, trainer: 3, spieler: 2, mitglied: 1, foerdermitglied: 0,
};

const BOARD_ROLES = new Set(['admin', 'vorstand']);

function roleBadgeVariant(role: string): 'default' | 'secondary' | 'outline' {
  if (role === 'admin') return 'default';
  if (role === 'vorstand' || role === 'trainer') return 'secondary';
  return 'outline';
}

// ── PDF helpers ───────────────────────────────────────────────────────────────

const PDF_STYLE = `
  body{font-family:system-ui,Arial,sans-serif;font-size:11px;color:#111;margin:0;padding:16px}
  h1{font-size:16px;margin:0 0 2px}
  p.sub{font-size:10px;color:#666;margin:0 0 12px}
  table{width:100%;border-collapse:collapse}
  th{background:#f3f4f6;text-align:left;padding:5px 8px;border-bottom:2px solid #d1d5db;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
  td{padding:5px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top}
  tr:last-child td{border-bottom:none}
  .badge{display:inline-block;padding:1px 6px;border-radius:4px;font-size:9px;font-weight:600;background:#e0e7ff;color:#3730a3;margin-right:3px}
  .sec{margin-top:14px}
  .sec-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:1px solid #e5e7eb;padding-bottom:3px;margin-bottom:6px}
  .row{display:grid;grid-template-columns:150px 1fr;gap:2px 8px;margin-bottom:3px}
  .lbl{color:#6b7280}
  @media print{@page{margin:1.5cm}body{padding:0}}
`;

function fmtIsoShort(iso: string | null | undefined): string {
  if (!iso) return '–';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

type BoardMemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  member_number: string | null;
  street: string | null;
  zip_code: string | null;
  city: string | null;
  date_of_birth: string | null;
  entry_date: string | null;
  exit_date: string | null;
  age_group: string | null;
  ttr_rating: number | null;
  qttr_rating: number | null;
  is_active: boolean;
  topRole: string | null;
  allRoles: string[];
};

function printBoardCompact(members: BoardMemberRow[], filterLabel: string) {
  const now = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const rows = members.map((m) => `<tr>
    <td>${m.last_name}, ${m.first_name}</td>
    <td>${m.email ?? '–'}</td>
    <td>${m.phone ?? '–'}</td>
    <td>${m.allRoles.map((r) => `<span class="badge">${ROLE_LABELS[r] ?? r}</span>`).join('') || '–'}</td>
  </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
    <title>Mitglieder – Kompaktübersicht</title><style>${PDF_STYLE}</style></head><body>
    <h1>Mitglieder – Kompaktübersicht</h1>
    <p class="sub">Stand: ${now} · ${filterLabel} · ${members.length} Einträge</p>
    <table>
      <thead><tr><th>Name</th><th>E-Mail</th><th>Telefon</th><th>Rollen</th></tr></thead>
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

function printBoardMemberProfile(m: BoardMemberRow) {
  const now = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const f = (lbl: string, val: string | null | undefined) =>
    `<div class="row"><span class="lbl">${lbl}</span><span>${val ?? '–'}</span></div>`;

  const rolesHtml = m.allRoles.length
    ? m.allRoles.map((r) => `<span class="badge">${ROLE_LABELS[r] ?? r}</span>`).join('')
    : '–';

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
    <title>Profil – ${m.first_name} ${m.last_name}</title><style>${PDF_STYLE}</style></head><body>
    <h1>Mitgliedsprofil</h1>
    <p class="sub">Erstellt am ${now}</p>
    <div class="sec">
      <div class="sec-title">Persönliche Daten</div>
      ${f('Nachname', m.last_name)}
      ${f('Vorname', m.first_name)}
      ${f('Mitgliedsnr.', m.member_number)}
      ${f('Geburtsdatum', fmtIsoShort(m.date_of_birth))}
    </div>
    <div class="sec">
      <div class="sec-title">Kontakt</div>
      ${f('E-Mail', m.email)}
      ${f('Telefon', m.phone)}
      ${f('Straße', m.street)}
      ${f('PLZ / Ort', [m.zip_code, m.city].filter(Boolean).join(' ') || null)}
    </div>
    <div class="sec">
      <div class="sec-title">Mitgliedschaft</div>
      ${f('Eintrittsdatum', fmtIsoShort(m.entry_date))}
      ${f('Austrittsdatum', fmtIsoShort(m.exit_date))}
      ${f('Status', m.is_active ? 'Aktiv' : 'Inaktiv')}
      ${f('Altersgruppe', m.age_group)}
    </div>
    <div class="sec">
      <div class="sec-title">Spielstärke</div>
      ${f('TTR', m.ttr_rating?.toString() ?? null)}
      ${f('QTTR', m.qttr_rating?.toString() ?? null)}
    </div>
    <div class="sec">
      <div class="sec-title">Rollen</div>
      <div class="row"><span class="lbl">Systemrollen</span><span>${rolesHtml}</span></div>
    </div>
  </body></html>`;

  const w = window.open('', '_blank', 'width=800,height=700');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// ── Component ─────────────────────────────────────────────────────────────────

function BoardMembersTab() {
  const [nurVorstand, setNurVorstand] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ['board-members-all'],
    queryFn: async () => {
      const [{ data: memberData, error: memberErr }, { data: roleData, error: roleErr }] =
        await Promise.all([
          supabase
            .from('members')
            .select('id, first_name, last_name, email, phone, member_number, street, zip_code, city, date_of_birth, entry_date, exit_date, age_group, ttr_rating, qttr_rating, is_active')
            .eq('is_active', true)
            .order('last_name'),
          supabase.from('member_roles').select('member_id, role'),
        ]);
      if (memberErr) throw memberErr;
      if (roleErr) throw roleErr;

      // Build per-member role lists + highest-priority role
      const allRolesMap = new Map<string, string[]>();
      const topRoleMap = new Map<string, string>();
      for (const r of roleData ?? []) {
        allRolesMap.set(r.member_id, [...(allRolesMap.get(r.member_id) ?? []), r.role]);
        const current = topRoleMap.get(r.member_id);
        if ((ROLE_PRIORITY[r.role] ?? -1) > (ROLE_PRIORITY[current ?? ''] ?? -1)) {
          topRoleMap.set(r.member_id, r.role);
        }
      }

      return (memberData ?? []).map((m): BoardMemberRow => ({
        ...m,
        topRole: topRoleMap.get(m.id) ?? null,
        allRoles: allRolesMap.get(m.id) ?? [],
      }));
    },
  });

  const displayed = nurVorstand
    ? (rows ?? []).filter((m) => m.topRole != null && BOARD_ROLES.has(m.topRole))
    : (rows ?? []);

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Switch id="nur-vorstand" checked={nurVorstand} onCheckedChange={setNurVorstand} />
        <Label htmlFor="nur-vorstand" className="cursor-pointer text-sm">Nur Vorstand</Label>
        <span className="text-sm text-muted-foreground">{displayed.length} Mitglied{displayed.length !== 1 ? 'er' : ''}</span>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={displayed.length === 0}
          onClick={() => printBoardCompact(displayed, nurVorstand ? 'Nur Vorstand' : 'Alle Mitglieder')}
        >
          <FileDown className="mr-2 h-4 w-4" /> Kompakt PDF
        </Button>
      </div>

      {displayed.length === 0 ? (
        <EmptyState
          icon={Users}
          title={nurVorstand ? 'Keine Vorstandsmitglieder' : 'Keine Mitglieder'}
          description={nurVorstand ? 'Es gibt noch keine Mitglieder mit Vorstandsrolle.' : 'Es sind noch keine aktiven Mitglieder vorhanden.'}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.first_name} {m.last_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.email ? <a href={`mailto:${m.email}`} className="hover:text-foreground">{m.email}</a> : '–'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.phone ?? '–'}</TableCell>
                  <TableCell>
                    {m.topRole ? (
                      <Badge variant={roleBadgeVariant(m.topRole)}>
                        {ROLE_LABELS[m.topRole] ?? m.topRole}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">–</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      title="Profil als PDF"
                      onClick={() => printBoardMemberProfile(m)}
                    >
                      <FileDown className="h-4 w-4" />
                    </Button>
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
// TAB 2: News-Editor
// ═══════════════════════════════════════════════════════════════════════════════

function NewsEditorTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<NewsItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const { data: news, isLoading } = useQuery({
    queryKey: ['board-news'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as NewsItem[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (input: { id?: string; title: string; content: string; is_published: boolean; image_url: string | null }) => {
      if (input.id) {
        const { error } = await supabase.from('news').update({
          title: input.title,
          content: input.content,
          is_published: input.is_published,
          image_url: input.image_url,
          published_at: input.is_published ? new Date().toISOString() : null,
        }).eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('news').insert({
          title: input.title,
          content: input.content,
          is_published: input.is_published,
          image_url: input.image_url,
          published_at: input.is_published ? new Date().toISOString() : null,
          author_id: user!.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-news'] });
      queryClient.invalidateQueries({ queryKey: ['news'] });
      toast.success(editItem ? 'News aktualisiert' : 'News erstellt');
      closeDialog();
    },
    onError: () => toast.error('Fehler beim Speichern'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('news').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-news'] });
      queryClient.invalidateQueries({ queryKey: ['news'] });
      toast.success('News gelöscht');
    },
    onError: () => toast.error('Fehler beim Löschen'),
  });

  const openCreate = () => {
    setEditItem(null);
    setTitle('');
    setContent('');
    setIsPublished(false);
    setImageUrl(null);
    setDialogOpen(true);
  };

  const openEdit = (item: NewsItem) => {
    setEditItem(item);
    setTitle(item.title);
    setContent(item.content);
    setIsPublished(item.is_published);
    setImageUrl(item.image_url);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditItem(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `news/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('board-files').upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('board-files').getPublicUrl(path);
      setImageUrl(urlData.publicUrl);
      toast.success('Bild hochgeladen');
    } catch {
      toast.error('Fehler beim Hochladen');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Titel und Inhalt sind erforderlich');
      return;
    }
    saveMutation.mutate({
      id: editItem?.id,
      title: title.trim(),
      content: content.trim(),
      is_published: isPublished,
      image_url: imageUrl,
    });
  };

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Neue News
        </Button>
      </div>

      {!news?.length ? (
        <EmptyState icon={Newspaper} title="Keine News" description="Erstelle die erste Vereinsnachricht." actionLabel="News erstellen" onAction={openCreate} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Bild</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {news.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell>
                    <Badge variant={item.is_published ? 'default' : 'outline'}>
                      {item.is_published ? 'Veröffentlicht' : 'Entwurf'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.image_url ? (
                      <Image className="h-4 w-4 text-primary" />
                    ) : (
                      <span className="text-muted-foreground text-sm">–</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fmtDateTime(item.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(item.id)}>
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

      {/* News Editor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? 'News bearbeiten' : 'Neue News erstellen'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel der Nachricht" />
            </div>
            <div className="space-y-2">
              <Label>Inhalt</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Nachrichteninhalt…" rows={6} />
            </div>
            <div className="space-y-2">
              <Label>Bild</Label>
              <div className="flex items-center gap-3">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  {uploading ? 'Lädt…' : 'Bild hochladen'}
                </Button>
                {imageUrl && (
                  <div className="flex items-center gap-2">
                    <img src={imageUrl} alt="Preview" className="h-10 w-10 rounded object-cover border" />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl(null)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={isPublished} onCheckedChange={setIsPublished} />
              <Label>Sofort veröffentlichen</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Speichert…' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>News löschen?</AlertDialogTitle>
            <AlertDialogDescription>Diese Nachricht wird dauerhaft entfernt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null); } }}
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
// TAB 3: Dokumente
// ═══════════════════════════════════════════════════════════════════════════════

function DocumentsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docDesc, setDocDesc] = useState('');
  const [docCategory, setDocCategory] = useState('allgemein');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: docs, isLoading } = useQuery({
    queryKey: ['board-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Array<{
        id: string; title: string; description: string | null;
        file_url: string | null; category: string; uploaded_by: string; created_at: string;
      }>;
    },
  });

  const handleUpload = async () => {
    if (!docTitle.trim()) { toast.error('Titel erforderlich'); return; }
    setUploading(true);
    try {
      let fileUrl: string | null = null;
      if (docFile) {
        const ext = docFile.name.split('.').pop();
        const path = `documents/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('board-files').upload(path, docFile);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('board-files').getPublicUrl(path);
        fileUrl = urlData.publicUrl;
      }
      const { error } = await supabase.from('documents').insert({
        title: docTitle.trim(),
        description: docDesc.trim() || null,
        category: docCategory,
        file_url: fileUrl,
        uploaded_by: user!.id,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['board-documents'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Dokument hochgeladen');
      setDialogOpen(false);
      setDocTitle('');
      setDocDesc('');
      setDocFile(null);
    } catch {
      toast.error('Fehler beim Hochladen');
    } finally {
      setUploading(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-documents'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Dokument gelöscht');
    },
    onError: () => toast.error('Fehler beim Löschen'),
  });

  const CATS: Record<string, string> = { allgemein: 'Allgemein', protokoll: 'Protokoll', satzung: 'Satzung', formular: 'Formular' };

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Dokument hochladen
        </Button>
      </div>

      {!docs?.length ? (
        <EmptyState icon={FileText} title="Keine Dokumente" description="Lade das erste Dokument hoch." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.title}</TableCell>
                  <TableCell><Badge variant="secondary">{CATS[doc.category] ?? doc.category}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{doc.description ?? '–'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDateTime(doc.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {doc.file_url && (
                        <Button size="icon" variant="ghost" asChild>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /></a>
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(doc.id)}>
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

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Dokument hochladen</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Dokumenttitel" />
            </div>
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <select
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Textarea value={docDesc} onChange={(e) => setDocDesc(e.target.value)} placeholder="Optionale Beschreibung" rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Datei</Label>
              <Input type="file" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Lädt hoch…' : 'Hochladen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dokument löschen?</AlertDialogTitle>
            <AlertDialogDescription>Das Dokument wird dauerhaft entfernt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null); } }}
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
// TAB 4: Sitzungen
// ═══════════════════════════════════════════════════════════════════════════════

function MeetingsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Meeting | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [docDialogMeetingId, setDocDialogMeetingId] = useState<string | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [uploading, setUploading] = useState(false);

  // Form state
  const [mTitle, setMTitle] = useState('');
  const [mDate, setMDate] = useState('');
  const [mTime, setMTime] = useState('');
  const [mLocation, setMLocation] = useState('');
  const [mDescription, setMDescription] = useState('');

  const { data: meetings, isLoading } = useQuery({
    queryKey: ['meetings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .order('meeting_date', { ascending: false });
      if (error) throw error;
      return data as Meeting[];
    },
  });

  const { data: meetingDocs } = useQuery({
    queryKey: ['meeting-documents'],
    queryFn: async () => {
      const { data, error } = await supabase.from('meeting_documents').select('*');
      if (error) throw error;
      return data as MeetingDoc[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (input: { id?: string; title: string; meeting_date: string; meeting_time: string | null; location: string | null; description: string | null }) => {
      if (input.id) {
        const { error } = await supabase.from('meetings').update({
          title: input.title,
          meeting_date: input.meeting_date,
          meeting_time: input.meeting_time,
          location: input.location,
          description: input.description,
        }).eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('meetings').insert({
          title: input.title,
          meeting_date: input.meeting_date,
          meeting_time: input.meeting_time,
          location: input.location,
          description: input.description,
          created_by: user!.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success(editItem ? 'Sitzung aktualisiert' : 'Sitzung erstellt');
      closeDialog();
    },
    onError: () => toast.error('Fehler beim Speichern'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meetings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Sitzung gelöscht');
    },
    onError: () => toast.error('Fehler beim Löschen'),
  });

  const openCreate = () => {
    setEditItem(null);
    setMTitle(''); setMDate(''); setMTime(''); setMLocation(''); setMDescription('');
    setDialogOpen(true);
  };

  const openEdit = (m: Meeting) => {
    setEditItem(m);
    setMTitle(m.title);
    setMDate(m.meeting_date);
    setMTime(m.meeting_time ?? '');
    setMLocation(m.location ?? '');
    setMDescription(m.description ?? '');
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditItem(null); };

  const handleSave = () => {
    if (!mTitle.trim() || !mDate) { toast.error('Titel und Datum erforderlich'); return; }
    saveMutation.mutate({
      id: editItem?.id,
      title: mTitle.trim(),
      meeting_date: mDate,
      meeting_time: mTime || null,
      location: mLocation.trim() || null,
      description: mDescription.trim() || null,
    });
  };

  const handleDocUpload = async () => {
    if (!docFile || !docTitle.trim() || !docDialogMeetingId) return;
    setUploading(true);
    try {
      const ext = docFile.name.split('.').pop();
      const path = `meetings/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('board-files').upload(path, docFile);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('board-files').getPublicUrl(path);
      const { error } = await supabase.from('meeting_documents').insert({
        meeting_id: docDialogMeetingId,
        title: docTitle.trim(),
        file_url: urlData.publicUrl,
        uploaded_by: user!.id,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['meeting-documents'] });
      toast.success('Dokument hochgeladen');
      setDocDialogMeetingId(null);
      setDocTitle('');
      setDocFile(null);
    } catch {
      toast.error('Fehler beim Hochladen');
    } finally {
      setUploading(false);
    }
  };

  const docsForMeeting = (meetingId: string) =>
    (meetingDocs ?? []).filter((d) => d.meeting_id === meetingId);

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Neue Sitzung</Button>
      </div>

      {!meetings?.length ? (
        <EmptyState icon={Calendar} title="Keine Sitzungen" description="Plane die erste Vorstandssitzung." actionLabel="Sitzung erstellen" onAction={openCreate} />
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => {
            const docs = docsForMeeting(m.id);
            return (
              <div key={m.id} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{m.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {fmtDate(m.meeting_date)}
                      {m.meeting_time && ` · ${m.meeting_time.slice(0, 5)} Uhr`}
                      {m.location && ` · ${m.location}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setDocDialogMeetingId(m.id)}>
                      <Upload className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(m)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(m.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {m.description && (
                  <p className="text-sm text-muted-foreground">{m.description}</p>
                )}
                {docs.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {docs.map((d) => (
                      <a key={d.id} href={d.file_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <FileText className="h-3 w-3" />{d.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Meeting Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editItem ? 'Sitzung bearbeiten' : 'Neue Sitzung'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Titel / Thema</Label><Input value={mTitle} onChange={(e) => setMTitle(e.target.value)} placeholder="z.B. Jahreshauptversammlung" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Datum</Label><Input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Uhrzeit</Label><Input type="time" value={mTime} onChange={(e) => setMTime(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Ort</Label><Input value={mLocation} onChange={(e) => setMLocation(e.target.value)} placeholder="Vereinsheim" /></div>
            <div className="space-y-2"><Label>Beschreibung</Label><Textarea value={mDescription} onChange={(e) => setMDescription(e.target.value)} rows={3} placeholder="Tagesordnung…" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Speichert…' : 'Speichern'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Doc Upload Dialog */}
      <Dialog open={!!docDialogMeetingId} onOpenChange={(o) => !o && setDocDialogMeetingId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Sitzungsdokument hochladen</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Titel</Label><Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="z.B. Protokoll" /></div>
            <div className="space-y-2"><Label>Datei</Label><Input type="file" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocDialogMeetingId(null)}>Abbrechen</Button>
            <Button onClick={handleDocUpload} disabled={uploading}>{uploading ? 'Lädt…' : 'Hochladen'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Sitzung löschen?</AlertDialogTitle><AlertDialogDescription>Die Sitzung und zugehörige Dokumente werden dauerhaft entfernt.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 5: E-Mail
// ═══════════════════════════════════════════════════════════════════════════════

function EmailTab() {
  const { data: members } = useQuery({
    queryKey: ['members-active-email'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, first_name, last_name, email')
        .eq('is_active', true)
        .order('last_name');
      if (error) throw error;
      return data;
    },
  });

  const membersWithEmail = (members ?? []).filter((m) => m.email);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-5 space-y-3">
        <h3 className="font-semibold">Schnell-E-Mail</h3>
        <p className="text-sm text-muted-foreground">
          Klicke auf eine Gruppe, um eine E-Mail in deinem Standard-Mailprogramm zu öffnen.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`mailto:${membersWithEmail.map((m) => m.email).join(',')}`}>
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Alle Mitglieder ({membersWithEmail.length})
            </a>
          </Button>
        </div>
      </div>

      {membersWithEmail.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membersWithEmail.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.first_name} {m.last_name}</TableCell>
                  <TableCell>
                    <a href={`mailto:${m.email}`} className="text-sm text-primary hover:underline">{m.email}</a>
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
// TAB 6: Listen
// ═══════════════════════════════════════════════════════════════════════════════

function ListsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [listName, setListName] = useState('');
  const [listDesc, setListDesc] = useState('');
  const [listType, setListType] = useState('email');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: lists, isLoading } = useQuery({
    queryKey: ['board-comm-lists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_lists')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as CommList[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('communication_lists').insert({
        name: listName.trim(),
        description: listDesc.trim() || null,
        list_type: listType,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-comm-lists'] });
      queryClient.invalidateQueries({ queryKey: ['communication-lists'] });
      toast.success('Liste erstellt');
      setDialogOpen(false);
      setListName('');
      setListDesc('');
    },
    onError: () => toast.error('Fehler beim Erstellen'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('communication_lists').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-comm-lists'] });
      toast.success('Liste gelöscht');
    },
    onError: () => toast.error('Fehler beim Löschen'),
  });

  const TYPE_LABELS: Record<string, string> = { email: 'E-Mail', whatsapp: 'WhatsApp', telefon: 'Telefon' };

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neue Liste
        </Button>
      </div>

      {!lists?.length ? (
        <EmptyState icon={ListChecks} title="Keine Listen" description="Erstelle die erste Kommunikationsliste." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lists.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell><Badge variant="outline">{TYPE_LABELS[l.list_type] ?? l.list_type}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.description ?? '–'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDateTime(l.created_at)}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(l.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Neue Liste</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Name</Label><Input value={listName} onChange={(e) => setListName(e.target.value)} placeholder="z.B. Mannschaftsführer" /></div>
            <div className="space-y-2">
              <Label>Typ</Label>
              <select value={listType} onChange={(e) => setListType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-2"><Label>Beschreibung</Label><Textarea value={listDesc} onChange={(e) => setListDesc(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !listName.trim()}>Erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Liste löschen?</AlertDialogTitle><AlertDialogDescription>Die Liste wird dauerhaft entfernt.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 0: Übersicht
// ═══════════════════════════════════════════════════════════════════════════════

function OverviewTab() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = role === 'admin' || role === 'developer' || role === 'vorstand';

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['board-overview'],
    queryFn: async () => {
      const result = await (await import('@/services/boardMemberService')).boardMemberService.listActive();
      if (!result.success) throw new Error('Fehler beim Laden');
      return result.data;
    },
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<(typeof members)[0] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Add form state
  const [addForm, setAddForm] = useState({ userId: '', position: '', termStart: '', termEnd: '', notes: '' });
  const [editForm, setEditForm] = useState({ position: '', termStart: '', termEnd: '', notes: '' });

  const { data: allMembers = [] } = useQuery({
    queryKey: ['members-with-user'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, user_id, first_name, last_name')
        .not('user_id', 'is', null)
        .eq('is_active', true)
        .order('last_name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: addOpen,
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const { boardMemberService: svc } = await import('@/services/boardMemberService');
      const result = await svc.createForActor(role as any, {
        user_id: addForm.userId,
        position: addForm.position,
        term_start: addForm.termStart || null,
        term_end: addForm.termEnd || null,
        notes: addForm.notes || null,
      });
      if (!result.success) throw new Error(result.error.message);
    },
    onSuccess: () => {
      toast.success('Vorstandsmitglied hinzugefügt');
      setAddOpen(false);
      setAddForm({ userId: '', position: '', termStart: '', termEnd: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['board-overview'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editMut = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { boardMemberService: svc } = await import('@/services/boardMemberService');
      const result = await svc.updateForActor(role as any, editing.id, {
        position: editForm.position,
        term_start: editForm.termStart || null,
        term_end: editForm.termEnd || null,
        notes: editForm.notes || null,
      });
      if (!result.success) throw new Error(result.error.message);
    },
    onSuccess: () => {
      toast.success('Gespeichert');
      setEditOpen(false);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['board-overview'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { boardMemberService: svc } = await import('@/services/boardMemberService');
      const result = await svc.removeForActor(role as any, id);
      if (!result.success) throw new Error(result.error.message);
    },
    onSuccess: () => {
      toast.success('Entfernt');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['board-overview'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(m: (typeof members)[0]) {
    setEditing(m);
    setEditForm({
      position: m.position,
      termStart: m.termStart ?? '',
      termEnd: m.termEnd ?? '',
      notes: m.notes ?? '',
    });
    setEditOpen(true);
  }

  const initials = (m: (typeof members)[0]) =>
    `${(m.firstName?.[0] ?? '').toUpperCase()}${(m.lastName?.[0] ?? '').toUpperCase()}`;

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Vorstand</h2>
          <p className="text-sm text-muted-foreground">Ihre Ansprechpartner im Verein.</p>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Hinzufügen
          </Button>
        )}
      </div>

      {members.length === 0 ? (
        <EmptyState icon={Users} title="Keine Vorstandsmitglieder" description="Noch keine aktiven Einträge vorhanden." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((m) => (
            <div key={m.id} className="rounded-lg border p-4 space-y-3 relative group">
              {canEdit && (
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(m.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              <p className="text-sm font-semibold text-primary">{m.position}</p>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                  {initials(m)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.firstName} {m.lastName}</p>
                  {m.termStart && (
                    <p className="text-xs text-muted-foreground">
                      seit {fmtDate(m.termStart)}{m.termEnd ? ` – ${fmtDate(m.termEnd)}` : ''}
                    </p>
                  )}
                </div>
              </div>
              {(m.email || m.role) && (
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {m.email && (
                    <a href={`mailto:${m.email}`} className="flex items-center gap-1 hover:text-foreground">
                      <Mail className="h-3.5 w-3.5" /> E-Mail
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Vorstandsmitglied hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Mitglied <span className="text-destructive">*</span></Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={addForm.userId}
                onChange={(e) => setAddForm((f) => ({ ...f, userId: e.target.value }))}
              >
                <option value="">Mitglied auswählen…</option>
                {allMembers.map((m) => (
                  <option key={m.user_id!} value={m.user_id!}>
                    {m.last_name}, {m.first_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Position <span className="text-destructive">*</span></Label>
              <Input value={addForm.position} onChange={(e) => setAddForm((f) => ({ ...f, position: e.target.value }))} placeholder="z. B. Kassenwart" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Amtsantritt</Label>
                <Input type="date" value={addForm.termStart} onChange={(e) => setAddForm((f) => ({ ...f, termStart: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Amtsende</Label>
                <Input type="date" value={addForm.termEnd} onChange={(e) => setAddForm((f) => ({ ...f, termEnd: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notizen</Label>
              <Textarea rows={2} value={addForm.notes} onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Abbrechen</Button>
            <Button
              onClick={() => {
                if (!addForm.userId || !addForm.position.trim()) { toast.error('Mitglied und Position sind Pflichtfelder'); return; }
                addMut.mutate();
              }}
              disabled={addMut.isPending}
            >Hinzufügen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => !o && setEditOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Eintrag bearbeiten</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Position <span className="text-destructive">*</span></Label>
              <Input value={editForm.position} onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Amtsantritt</Label>
                <Input type="date" value={editForm.termStart} onChange={(e) => setEditForm((f) => ({ ...f, termStart: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Amtsende</Label>
                <Input type="date" value={editForm.termEnd} onChange={(e) => setEditForm((f) => ({ ...f, termEnd: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notizen</Label>
              <Textarea rows={2} value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Abbrechen</Button>
            <Button
              onClick={() => {
                if (!editForm.position.trim()) { toast.error('Position ist ein Pflichtfeld'); return; }
                editMut.mutate();
              }}
              disabled={editMut.isPending}
            >Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eintrag entfernen</AlertDialogTitle>
            <AlertDialogDescription>Soll dieses Vorstandsmitglied wirklich entfernt werden?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget)}
            >Entfernen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_TABS = ['uebersicht', 'mitglieder', 'news', 'dokumente', 'sitzungen', 'email', 'listen'] as const;
type TabValue = typeof VALID_TABS[number];

export default function Board() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as TabValue | null;
  const activeTab: TabValue = rawTab && VALID_TABS.includes(rawTab) ? rawTab : 'uebersicht';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Vorstand</h1>
        <p className="page-description">Vereinsführung, News, Sitzungen und Dokumente verwalten</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="uebersicht"><LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />Übersicht</TabsTrigger>
          <TabsTrigger value="mitglieder"><Users className="mr-1.5 h-3.5 w-3.5" />Mitglieder</TabsTrigger>
          <TabsTrigger value="news"><Newspaper className="mr-1.5 h-3.5 w-3.5" />News</TabsTrigger>
          <TabsTrigger value="dokumente"><FileText className="mr-1.5 h-3.5 w-3.5" />Dokumente</TabsTrigger>
          <TabsTrigger value="sitzungen"><Calendar className="mr-1.5 h-3.5 w-3.5" />Sitzungen</TabsTrigger>
          <TabsTrigger value="email"><Mail className="mr-1.5 h-3.5 w-3.5" />E-Mail</TabsTrigger>
          <TabsTrigger value="listen"><ListChecks className="mr-1.5 h-3.5 w-3.5" />Listen</TabsTrigger>
        </TabsList>

        <TabsContent value="uebersicht"><OverviewTab /></TabsContent>
        <TabsContent value="mitglieder"><BoardMembersTab /></TabsContent>
        <TabsContent value="news"><NewsEditorTab /></TabsContent>
        <TabsContent value="dokumente"><DocumentsTab /></TabsContent>
        <TabsContent value="sitzungen"><MeetingsTab /></TabsContent>
        <TabsContent value="email"><EmailTab /></TabsContent>
        <TabsContent value="listen"><ListsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
