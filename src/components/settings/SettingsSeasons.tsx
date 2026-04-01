import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Star, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export default function SettingsSeasons() {
  const queryClient = useQueryClient();

  const { data: seasons = [], isLoading } = useQuery({
    queryKey: ['settings-seasons'],
    queryFn: async () => {
      const { data, error } = await supabase.from('seasons').select('*').order('start_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const setCurrentMut = useMutation({
    mutationFn: async (id: string) => {
      const season = seasons.find((s) => s.id === id);
      if (!season) return;
      const { error } = await supabase.from('seasons').update({ is_current: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-seasons'] });
      toast.success('Aktive Saison geändert');
    },
    onError: () => toast.error('Fehler'),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('seasons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-seasons'] });
      toast.success('Saison gelöscht');
    },
    onError: () => toast.error('Fehler beim Löschen'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saisonverwaltung</CardTitle>
        <CardDescription>Saisons verwalten und aktive Saison festlegen</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Zeitraum</TableHead>
                <TableHead>Altersgruppe</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Laden…</TableCell></TableRow>
              ) : seasons.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Keine Saisons</TableCell></TableRow>
              ) : (
                seasons.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(s.start_date), 'dd.MM.yyyy')} – {format(new Date(s.end_date), 'dd.MM.yyyy')}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{s.age_group}</Badge></TableCell>
                    <TableCell>
                      {s.is_current ? (
                        <Badge className="bg-success text-success-foreground">Aktiv</Badge>
                      ) : (
                        <Badge variant="secondary">Inaktiv</Badge>
                      )}
                    </TableCell>
                    <TableCell className="flex gap-1">
                      {!s.is_current && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCurrentMut.mutate(s.id)}>
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteMut.mutate(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
