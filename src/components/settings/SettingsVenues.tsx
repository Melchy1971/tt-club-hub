import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, MapPin, Pencil } from 'lucide-react';

export default function SettingsVenues() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', street: '', zip_code: '', city: '', is_home_venue: false });

  const { data: venues = [], isLoading } = useQuery({
    queryKey: ['settings-venues'],
    queryFn: async () => {
      const { data, error } = await supabase.from('venues').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Name erforderlich');
      if (editId) {
        const { error } = await supabase.from('venues').update(form).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('venues').insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-venues'] });
      toast.success(editId ? 'Spiellokal aktualisiert' : 'Spiellokal erstellt');
      setOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(e.message || 'Fehler'),
  });

  const resetForm = () => {
    setForm({ name: '', street: '', zip_code: '', city: '', is_home_venue: false });
    setEditId(null);
  };

  const openEdit = (venue: any) => {
    setEditId(venue.id);
    setForm({ name: venue.name, street: venue.street ?? '', zip_code: venue.zip_code ?? '', city: venue.city ?? '', is_home_venue: venue.is_home_venue });
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Spiellokale</CardTitle>
          <CardDescription>Spielorte für Heim- und Auswärtsspiele</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Neues Spiellokal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? 'Spiellokal bearbeiten' : 'Neues Spiellokal'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Straße</Label><Input value={form.street} onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>PLZ</Label><Input value={form.zip_code} onChange={(e) => setForm((f) => ({ ...f, zip_code: e.target.value }))} /></div>
                <div><Label>Ort</Label><Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_home_venue} onCheckedChange={(v) => setForm((f) => ({ ...f, is_home_venue: v }))} />
                <Label>Heimspielort</Label>
              </div>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="w-full">Speichern</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Laden…</TableCell></TableRow>
              ) : venues.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Keine Spiellokale</TableCell></TableRow>
              ) : (
                venues.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{v.name}</TableCell>
                    <TableCell className="text-muted-foreground">{[v.street, v.zip_code, v.city].filter(Boolean).join(', ') || '–'}</TableCell>
                    <TableCell>{v.is_home_venue ? <Badge className="bg-primary text-primary-foreground">Heim</Badge> : <Badge variant="outline">Auswärts</Badge>}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
