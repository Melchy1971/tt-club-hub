/**
 * TeamRosterDialog - Spieler einer Mannschaft zuordnen / entfernen.
 * Spieler können in mehreren Mannschaften gleichzeitig sein.
 */
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Save, Search, UserMinus, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

interface TeamRosterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: { id: string; name: string } | null;
}

function parsePosition(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function getNextFreePosition(rows: any[] = []): number {
  const used = new Set(
    rows
      .map((r) => r.position)
      .filter((p): p is number => Number.isInteger(p) && p > 0),
  );
  let next = 1;
  while (used.has(next)) next += 1;
  return next;
}

export function TeamRosterDialog({ open, onOpenChange, team }: TeamRosterDialogProps) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'roster' | 'add'>('roster');
  const [addPosition, setAddPosition] = useState('1');
  const [positionEdits, setPositionEdits] = useState<Record<string, string>>({});
  const [isNormalizing, setIsNormalizing] = useState(false);
  const queryClient = useQueryClient();

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

  const usedPositions = useMemo(
    () => new Set((roster ?? []).map((r: any) => r.position)),
    [roster],
  );

  useEffect(() => {
    if (!open) return;
    const rows = roster ?? [];
    const edits: Record<string, string> = {};
    rows.forEach((r: any) => {
      edits[r.id] = String(r.position ?? '');
    });
    setPositionEdits(edits);
    setAddPosition(String(getNextFreePosition(rows)));
  }, [open, roster]);

  const normalizeRosterPositions = useMutation({
    mutationFn: async (rows: any[]) => {
      const sorted = [...rows].sort((a: any, b: any) => {
        const aPos = Number.isInteger(a.position) ? a.position : Number.MAX_SAFE_INTEGER;
        const bPos = Number.isInteger(b.position) ? b.position : Number.MAX_SAFE_INTEGER;
        if (aPos !== bPos) return aPos - bPos;
        const aName = `${a.members?.last_name ?? ''} ${a.members?.first_name ?? ''}`.toLowerCase();
        const bName = `${b.members?.last_name ?? ''} ${b.members?.first_name ?? ''}`.toLowerCase();
        if (aName !== bName) return aName.localeCompare(bName);
        return String(a.id).localeCompare(String(b.id));
      });

      // Phase 1: temporary unique positions to avoid unique-constraint collisions.
      for (let i = 0; i < sorted.length; i += 1) {
        const tempPosition = 1000 + i + 1;
        const { error } = await supabase
          .from('team_members')
          .update({ position: tempPosition })
          .eq('id', sorted[i].id);
        if (error) throw error;
      }

      // Phase 2: final normalized positions 1..n.
      for (let i = 0; i < sorted.length; i += 1) {
        const finalPosition = i + 1;
        const { error } = await supabase
          .from('team_members')
          .update({ position: finalPosition })
          .eq('id', sorted[i].id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-roster', team?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
    },
  });

  useEffect(() => {
    if (!open || !roster || roster.length === 0 || isNormalizing || normalizeRosterPositions.isPending) return;

    const positions = roster.map((r: any) => r.position);
    const hasNonPositive = positions.some((p: any) => !Number.isInteger(p) || p <= 0);
    const uniqueCount = new Set(positions).size;
    const hasDuplicates = uniqueCount !== positions.length;
    const startsAtOne = Math.min(...positions.filter((p: any) => Number.isInteger(p))) === 1;

    if (!hasNonPositive && !hasDuplicates && startsAtOne) return;

    setIsNormalizing(true);
    normalizeRosterPositions.mutate(roster, {
      onError: () => {
        toast.error('Positionen konnten nicht automatisch normalisiert werden.');
      },
      onSettled: () => {
        setIsNormalizing(false);
      },
    });
  }, [open, roster, isNormalizing, normalizeRosterPositions, queryClient, team?.id]);

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

  const rosterWithEffectivePosition = useMemo(() => {
    if (!roster) return [];

    return roster.map((r: any) => {
      const edited = positionEdits[r.id];
      const parsed = edited != null ? parsePosition(edited) : null;
      return {
        ...r,
        effectivePosition: parsed ?? (Number.isInteger(r.position) && r.position > 0 ? r.position : Number.MAX_SAFE_INTEGER),
      };
    });
  }, [roster, positionEdits]);

  const rosterFiltered = useMemo(() => {
    const sorted = [...rosterWithEffectivePosition].sort((a: any, b: any) => {
      const posDiff = (a.effectivePosition ?? 0) - (b.effectivePosition ?? 0);
      if (posDiff !== 0) return posDiff;
      const aName = `${a.members?.last_name ?? ''} ${a.members?.first_name ?? ''}`.toLowerCase();
      const bName = `${b.members?.last_name ?? ''} ${b.members?.first_name ?? ''}`.toLowerCase();
      return aName.localeCompare(bName);
    });

    if (!search) return sorted;
    const s = search.toLowerCase();
    return sorted.filter((r: any) =>
      `${r.members?.first_name ?? ''} ${r.members?.last_name ?? ''}`.toLowerCase().includes(s),
    );
  }, [rosterWithEffectivePosition, search]);

  const addMember = useMutation({
    mutationFn: async ({ memberId, position }: { memberId: string; position: number }) => {
      const { error } = await supabase
        .from('team_members')
        .insert({ team_id: team!.id, member_id: memberId, position });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-roster', team?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
      toast.success('Spieler zugeordnet');
      setSearch('');
    },
    onError: (error: any) => {
      if (error?.code === '23505') {
        toast.error('Diese Position ist in der Mannschaft bereits vergeben.');
        return;
      }
      toast.error('Fehler beim Zuordnen');
    },
  });

  const updatePosition = useMutation({
    mutationFn: async ({ id, position }: { id: string; position: number }) => {
      const { error } = await supabase
        .from('team_members')
        .update({ position })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-roster', team?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
      toast.success('Position aktualisiert');
    },
    onError: (error: any) => {
      if (error?.code === '23505') {
        toast.error('Diese Position ist in der Mannschaft bereits vergeben.');
        return;
      }
      toast.error('Fehler beim Speichern der Position');
    },
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
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
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
            placeholder="Spieler suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {tab === 'add' && (
          <div className="mb-3 space-y-1.5">
            <Label htmlFor="roster-add-position">Position *</Label>
            <Input
              id="roster-add-position"
              type="number"
              min={1}
              step={1}
              value={addPosition}
              onChange={(e) => setAddPosition(e.target.value)}
              className="w-32"
            />
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0">
          {tab === 'roster' ? (
            loadingRoster ? (
              <p className="text-sm text-muted-foreground p-4">Laden...</p>
            ) : !rosterFiltered.length ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Kein Spieler zugeordnet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Position</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>QTTR</TableHead>
                    <TableHead>TTR</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rosterFiltered.map((r: any) => {
                    const currentEdit = positionEdits[r.id] ?? String(r.position ?? '');
                    const parsed = parsePosition(currentEdit);
                    const hasConflict = parsed != null
                      && (rosterWithEffectivePosition ?? []).some((row: any) => row.id !== r.id && (row.effectivePosition ?? row.position) === parsed);
                    const unchanged = parsed === r.position;

                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm font-mono">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              value={currentEdit}
                              onChange={(e) => setPositionEdits((prev) => ({ ...prev, [r.id]: e.target.value }))}
                              className="h-8 w-20"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                if (parsed == null) {
                                  toast.error('Position muss eine positive ganze Zahl sein.');
                                  return;
                                }
                                if (hasConflict) {
                                  toast.error('Diese Position ist in der Mannschaft bereits vergeben.');
                                  return;
                                }
                                if (unchanged) return;
                                updatePosition.mutate({ id: r.id, position: parsed });
                              }}
                              disabled={updatePosition.isPending || parsed == null || hasConflict || unchanged}
                              title="Position speichern"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {r.members?.first_name} {r.members?.last_name}
                        </TableCell>
                        <TableCell className="text-sm">{r.members?.qttr_rating ?? '-'}</TableCell>
                        <TableCell className="text-sm">{r.members?.ttr_rating ?? '-'}</TableCell>
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
                    );
                  })}
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
                    <TableHead className="w-20">Pos</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>QTTR</TableHead>
                    <TableHead>TTR</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableMembers.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm font-mono">{addPosition}</TableCell>
                      <TableCell className="font-medium text-sm">
                        {m.first_name} {m.last_name}
                      </TableCell>
                      <TableCell className="text-sm">{m.qttr_rating ?? '-'}</TableCell>
                      <TableCell className="text-sm">{m.ttr_rating ?? '-'}</TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const parsed = parsePosition(addPosition);
                            if (parsed == null) {
                              toast.error('Position muss eine positive ganze Zahl sein.');
                              return;
                            }
                            if (usedPositions.has(parsed)) {
                              toast.error('Diese Position ist in der Mannschaft bereits vergeben.');
                              return;
                            }
                            addMember.mutate({ memberId: m.id, position: parsed }, {
                              onSuccess: () => setAddPosition(String(parsed + 1)),
                            });
                          }}
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
