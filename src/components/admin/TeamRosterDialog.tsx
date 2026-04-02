/**
 * TeamRosterDialog – Spieler einer Mannschaft zuordnen / entfernen.
 * Spieler können in mehreren Mannschaften gleichzeitig sein.
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, UserPlus, UserMinus, Users } from 'lucide-react';
import { toast } from 'sonner';

interface TeamRosterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: { id: string; name: string } | null;
}

export function TeamRosterDialog({ open, onOpenChange, team }: TeamRosterDialogProps) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'roster' | 'add'>('roster');
  const queryClient = useQueryClient();

  // Current roster
  const { data: roster, isLoading: loadingRoster } = useQuery({
    queryKey: ['team-roster', team?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*, members(id, first_name, last_name, ttr_rating, qttr_rating)')
        .eq('team_id', team!.id)
        .order('position', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!team?.id,
  });

  // All active members (for adding)
  const { data: allMembers } = useQuery({
    queryKey: ['all-active-members-for-roster'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, first_name, last_name, ttr_rating, qttr_rating')
        .eq('is_active', true)
        .order('last_name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && tab === 'add',
  });

  const assignedIds = useMemo(
    () => new Set((roster ?? []).map((r: any) => r.member_id)),
    [roster],
  );

  const availableMembers = useMemo(() => {
    if (!allMembers) return [];
    return allMembers.filter((m) => {
      if (assignedIds.has(m.id)) return false;
      if (search) {
        const s = search.toLowerCase();
        return `${m.first_name} ${m.last_name}`.toLowerCase().includes(s);
      }
      return true;
    });
  }, [allMembers, assignedIds, search]);

  const rosterFiltered = useMemo(() => {
    if (!roster) return [];
    if (!search) return roster;
    const s = search.toLowerCase();
    return roster.filter((r: any) =>
      `${r.members?.first_name ?? ''} ${r.members?.last_name ?? ''}`.toLowerCase().includes(s),
    );
  }, [roster, search]);

  const addMember = useMutation({
    mutationFn: async (memberId: string) => {
      const nextPosition = (roster ?? []).length;
      const { error } = await supabase
        .from('team_members')
        .insert({ team_id: team!.id, member_id: memberId, position: nextPosition });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-roster', team?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
      toast.success('Spieler zugeordnet');
    },
    onError: () => toast.error('Fehler beim Zuordnen'),
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', team!.id)
        .eq('member_id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-roster', team?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
      toast.success('Spieler entfernt');
    },
    onError: () => toast.error('Fehler beim Entfernen'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Kader: {team?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-3">
          <Button
            size="sm"
            variant={tab === 'roster' ? 'default' : 'outline'}
            onClick={() => { setTab('roster'); setSearch(''); }}
          >
            Kader ({roster?.length ?? 0})
          </Button>
          <Button
            size="sm"
            variant={tab === 'add' ? 'default' : 'outline'}
            onClick={() => { setTab('add'); setSearch(''); }}
          >
            <UserPlus className="h-4 w-4 mr-1" />
            Spieler hinzufügen
          </Button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Spieler suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {tab === 'roster' ? (
            loadingRoster ? (
              <p className="text-sm text-muted-foreground p-4">Laden…</p>
            ) : !rosterFiltered.length ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Kein Spieler zugeordnet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Pos</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>QTTR</TableHead>
                    <TableHead>TTR</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rosterFiltered.map((r: any, idx: number) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm font-mono">{idx + 1}</TableCell>
                      <TableCell className="font-medium text-sm">
                        {r.members?.first_name} {r.members?.last_name}
                      </TableCell>
                      <TableCell className="text-sm">{r.members?.qttr_rating ?? '–'}</TableCell>
                      <TableCell className="text-sm">{r.members?.ttr_rating ?? '–'}</TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeMember.mutate(r.member_id)}
                          disabled={removeMember.isPending}
                        >
                          <UserMinus className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          ) : (
            !availableMembers.length ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Keine weiteren Spieler verfügbar
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>QTTR</TableHead>
                    <TableHead>TTR</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableMembers.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium text-sm">
                        {m.first_name} {m.last_name}
                      </TableCell>
                      <TableCell className="text-sm">{m.qttr_rating ?? '–'}</TableCell>
                      <TableCell className="text-sm">{m.ttr_rating ?? '–'}</TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => addMember.mutate(m.id)}
                          disabled={addMember.isPending}
                        >
                          <UserPlus className="h-4 w-4 text-primary" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
