import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Search, UserPlus, Trash2 } from 'lucide-react';
import type { AppRole } from '@/types/auth';

const ROLE_LABELS: Record<string, string> = {
  developer: 'Developer',
  admin: 'Administrator',
  vorstand: 'Vorstand',
  trainer: 'Trainer',
  spieler: 'Spieler',
  mitglied: 'Mitglied',
};

export default function SettingsRoles() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: userRoles = [], isLoading } = useQuery({
    queryKey: ['settings-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('id, user_id, role, created_at');
      if (error) throw error;

      const userIds = [...new Set(data.map((r) => r.user_id))];
      const { data: members } = await supabase
        .from('members')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds);

      return data.map((r) => {
        const member = members?.find((m) => m.user_id === r.user_id);
        return {
          ...r,
          name: member ? `${member.first_name} ${member.last_name}` : '–',
          email: member?.email ?? '–',
        };
      });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_roles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-user-roles'] });
      toast.success('Rolle entfernt');
    },
    onError: () => toast.error('Fehler beim Entfernen'),
  });

  const filtered = userRoles.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase()) ||
      r.role.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rollenzuweisungen</CardTitle>
        <CardDescription>Übersicht aller Benutzer und deren zugewiesene Rollen</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Name, E-Mail oder Rolle…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Laden…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Keine Ergebnisse</TableCell></TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ROLE_LABELS[r.role] ?? r.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteMut.mutate(r.id)}
                        disabled={r.user_id === user?.id}
                      >
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
