import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Plus, Pencil, Trash2, Star, StarOff } from 'lucide-react';
import { seasonService } from '@/services/seasonService';
import { useSeason } from '@/contexts/SeasonContext';
import { useAuth } from '@/contexts/AuthContext';
import { canWriteSeasons, canDeleteSeasons } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { Constants } from '@/integrations/supabase/types';
import type { Season, SeasonInsert } from '@/types';

const AGE_GROUP_LABELS: Record<string, string> = {
  herren: 'Herren',
  damen: 'Damen',
  jungen_18: 'Jungen 18',
  maedchen_18: 'Mädchen 18',
  jungen_15: 'Jungen 15',
  maedchen_15: 'Mädchen 15',
  jungen_13: 'Jungen 13',
  maedchen_13: 'Mädchen 13',
  jungen_11: 'Jungen 11',
  maedchen_11: 'Mädchen 11',
  senioren: 'Senioren',
  seniorinnen: 'Seniorinnen',
};

const initialForm = {
  name: '',
  start_date: '',
  end_date: '',
  age_group: 'herren' as string,
  is_current: false,
};

export default function Seasons() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const { refresh: refreshSeason } = useSeason();
  const canWrite = canWriteSeasons(role);
  const canDelete = canDeleteSeasons(role);

  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: seasons = [], isLoading } = useQuery({
    queryKey: ['seasons'],
    queryFn: seasonService.getAll,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['seasons'] });
    refreshSeason();
  };

  const createMut = useMutation({
    mutationFn: (s: SeasonInsert) => seasonService.create(s),
    onSuccess: () => { toast.success('Saison erstellt'); invalidate(); closeForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SeasonInsert> }) =>
      seasonService.update(id, data),
    onSuccess: () => { toast.success('Saison aktualisiert'); invalidate(); closeForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => seasonService.remove(id),
    onSuccess: () => { toast.success('Saison gelöscht'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, val }: { id: string; val: boolean }) =>
      seasonService.toggleCurrent(id, val),
    onSuccess: () => { toast.success('Status aktualisiert'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  function closeForm() {
    setFormOpen(false);
    setEditingSeason(null);
    setForm(initialForm);
    setErrors({});
  }

  function openCreate() {
    setEditingSeason(null);
    setForm(initialForm);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(s: Season) {
    setEditingSeason(s);
    setForm({
      name: s.name,
      start_date: s.start_date,
      end_date: s.end_date,
      age_group: s.age_group,
      is_current: s.is_current,
    });
    setErrors({});
    setFormOpen(true);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name ist erforderlich';
    if (!form.start_date) e.start_date = 'Startdatum ist erforderlich';
    if (!form.end_date) e.end_date = 'Enddatum ist erforderlich';
    if (form.start_date && form.end_date && form.start_date >= form.end_date) {
      e.end_date = 'Enddatum muss nach dem Startdatum liegen';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    const payload: SeasonInsert = {
      name: form.name.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      age_group: form.age_group as any,
      is_current: form.is_current,
    };
    if (editingSeason) {
      updateMut.mutate({ id: editingSeason.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Saisonverwaltung</h1>
          <p className="text-muted-foreground">Saisons anlegen, bearbeiten und aktivieren</p>
        </div>
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Neue Saison
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-center py-12">Laden…</div>
      ) : seasons.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Keine Saisons"
          description="Erstelle die erste Saison, um loszulegen."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Altersgruppe</TableHead>
                <TableHead>Zeitraum</TableHead>
                <TableHead>Aktiv</TableHead>
                {canWrite && <TableHead className="text-right">Aktionen</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {seasons.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.name}
                    {s.is_current && (
                      <Badge variant="default" className="ml-2">Aktiv</Badge>
                    )}
                  </TableCell>
                  <TableCell>{AGE_GROUP_LABELS[s.age_group] ?? s.age_group}</TableCell>
                  <TableCell>
                    {s.start_date} – {s.end_date}
                  </TableCell>
                  <TableCell>
                    {canWrite ? (
                      <Switch
                        checked={s.is_current}
                        onCheckedChange={(val) => toggleMut.mutate({ id: s.id, val })}
                      />
                    ) : (
                      s.is_current ? (
                        <Star className="h-4 w-4 text-primary" />
                      ) : (
                        <StarOff className="h-4 w-4 text-muted-foreground" />
                      )
                    )}
                  </TableCell>
                  {canWrite && (
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => !o && closeForm()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSeason ? 'Saison bearbeiten' : 'Neue Saison'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="z.B. Saison 2025/26"
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="age_group">Altersgruppe</Label>
              <Select
                value={form.age_group}
                onValueChange={(v) => setForm({ ...form, age_group: v })}
              >
                <SelectTrigger id="age_group">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Constants.public.Enums.age_group.map((ag) => (
                    <SelectItem key={ag} value={ag}>
                      {AGE_GROUP_LABELS[ag] ?? ag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="start_date">Startdatum</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
                {errors.start_date && <p className="text-sm text-destructive">{errors.start_date}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end_date">Enddatum</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
                {errors.end_date && <p className="text-sm text-destructive">{errors.end_date}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="is_current"
                checked={form.is_current}
                onCheckedChange={(v) => setForm({ ...form, is_current: v })}
              />
              <Label htmlFor="is_current">Als aktive Saison setzen</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Abbrechen</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {editingSeason ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Saison löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Alle verknüpften Daten gehen verloren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteId) deleteMut.mutate(deleteId); setDeleteId(null); }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
