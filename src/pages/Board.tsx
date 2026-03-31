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
// TAB 1: Vorstandsmitglieder
// ═══════════════════════════════════════════════════════════════════════════════

function BoardMembersTab() {
  const { data: members, isLoading } = useQuery({
    queryKey: ['board-members'],
    queryFn: async () => {
      // Get user_ids with vorstand or admin role
      const { data: roleData, error: roleErr } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['vorstand', 'admin']);
      if (roleErr) throw roleErr;

      if (!roleData?.length) return [];

      const userIds = roleData.map((r) => r.user_id);
      const { data: memberData, error: memberErr } = await supabase
        .from('members')
        .select('*')
        .in('user_id', userIds)
        .eq('is_active', true)
        .order('last_name');
      if (memberErr) throw memberErr;

      // Attach role info
      const roleMap = new Map(roleData.map((r) => [r.user_id, r.role]));
      return (memberData ?? []).map((m) => ({
        ...m,
        boardRole: roleMap.get(m.user_id ?? '') ?? 'vorstand',
      }));
    },
  });

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrator',
    vorstand: 'Vorstand',
  };

  if (isLoading) return <LoadingSkeleton />;

  return !members?.length ? (
    <EmptyState
      icon={Users}
      title="Keine Vorstandsmitglieder"
      description="Es gibt noch keine Mitglieder mit Vorstandsrolle."
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-medium">{m.first_name} {m.last_name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{m.email ?? '–'}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{m.phone ?? '–'}</TableCell>
              <TableCell>
                <Badge variant={m.boardRole === 'admin' ? 'default' : 'secondary'}>
                  {ROLE_LABELS[m.boardRole] ?? m.boardRole}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_TABS = ['mitglieder', 'news', 'dokumente', 'sitzungen', 'email', 'listen'] as const;
type TabValue = typeof VALID_TABS[number];

export default function Board() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as TabValue | null;
  const activeTab: TabValue = rawTab && VALID_TABS.includes(rawTab) ? rawTab : 'mitglieder';

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
          <TabsTrigger value="mitglieder"><Users className="mr-1.5 h-3.5 w-3.5" />Mitglieder</TabsTrigger>
          <TabsTrigger value="news"><Newspaper className="mr-1.5 h-3.5 w-3.5" />News</TabsTrigger>
          <TabsTrigger value="dokumente"><FileText className="mr-1.5 h-3.5 w-3.5" />Dokumente</TabsTrigger>
          <TabsTrigger value="sitzungen"><Calendar className="mr-1.5 h-3.5 w-3.5" />Sitzungen</TabsTrigger>
          <TabsTrigger value="email"><Mail className="mr-1.5 h-3.5 w-3.5" />E-Mail</TabsTrigger>
          <TabsTrigger value="listen"><ListChecks className="mr-1.5 h-3.5 w-3.5" />Listen</TabsTrigger>
        </TabsList>

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
