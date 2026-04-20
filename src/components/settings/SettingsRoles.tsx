import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Search, Trash2 } from 'lucide-react';
import { APP_ROLE_LABELS } from '@/constants/permissionLabels';

export default function SettingsRoles() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: userRoles = [], isLoading } = useQuery({
    queryKey: ['settings-member-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_roles')
        .select('id, member_id, role, created_at');
      if (error) throw error;

      const memberIds = [...new Set((data ?? []).map((r) => r.member_id))];
      const { data: members } = memberIds.length
        ? await supabase
            .from('members')
            .select('id, user_id, first_name, last_name, email')
            .in('id', memberIds)
        : { data: [] as Array<{ id: string; user_id: string | null; first_name: string; last_name: string; email: string | null }> };

      return (data ?? []).map((r) => {
        const member = members?.find((m) => m.id === r.member_id);
        return {
          id: r.id,
          member_id: r.member_id,
          user_id: member?.user_id ?? null,
          role: r.role,
          created_at: r.created_at,
          name: member ? `${member.first_name} ${member.last_name}` : '–',
          email: member?.email ?? '–',
        };
      });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('member_roles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-member-roles'] });
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
                      <Badge variant="outline">{APP_ROLE_LABELS[r.role] ?? r.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteMut.mutate(r.id)}
                        disabled={r.user_id === user?.id || r.role === 'developer'}
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
