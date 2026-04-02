import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, UserPlus, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import type { ScheduleMatch, Member } from '@/types';

type AvailabilityStatus = 'available' | 'unavailable' | 'unknown';

const AVAIL_ICON: Record<AvailabilityStatus, React.ReactNode> = {
  available: <Check className="h-3 w-3 text-green-600" />,
  unavailable: <X className="h-3 w-3 text-destructive" />,
    unknown: null,
};

interface Props {
  match: ScheduleMatch;
  teamId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LineupDialog({ match, teamId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Team members
  const { data: teamMembers } = useQuery({
    queryKey: ['team-members-detail', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('member_id, position, members(id, first_name, last_name, ttr_rating)')
        .eq('team_id', teamId)
        .order('position', { ascending: true });
      if (error) throw error;
      return data as Array<{ member_id: string; position: number; members: Member }>;
    },
    enabled: open,
  });

  // Availability
  const { data: availability } = useQuery({
    queryKey: ['match-availability', match.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_player_availability' as never)
        .select('*')
        .eq('match_id', match.id);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Existing lineup
  const { data: existingLineup } = useQuery({
    queryKey: ['match-lineup', match.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_lineup')
        .select('*')
        .eq('match_id', match.id);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const availMap = useMemo(() => {
    const m = new Map<string, AvailabilityStatus>();
    availability?.forEach((a) => m.set(a.member_id, a.status as AvailabilityStatus));
    return m;
  }, [availability]);

  useEffect(() => {
    if (existingLineup) {
      setSelected(new Set(existingLineup.map((l) => l.member_id)));
    }
  }, [existingLineup]);

  const toggle = (memberId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Delete old lineup
      const { error: delErr } = await supabase
        .from('match_lineup')
        .delete()
        .eq('match_id', match.id);
      if (delErr) throw delErr;

      if (selected.size === 0) return;

      // Find positions from team members
      const entries = Array.from(selected).map((memberId, idx) => {
        const tm = teamMembers?.find((t) => t.member_id === memberId);
        return {
          match_id: match.id,
          member_id: memberId,
          position: tm?.position ?? idx + 1,
        };
      }).sort((a, b) => a.position - b.position);

      const { error } = await supabase.from('match_lineups' as never).insert(entries);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-lineup', match.id] });
      toast.success('Aufstellung gespeichert');
      onOpenChange(false);
    },
    onError: () => toast.error('Fehler beim Speichern'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aufstellung</DialogTitle>
          <DialogDescription>
            {match.home_team} – {match.away_team} · {selected.size} Spieler ausgewählt
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {teamMembers?.map((tm) => {
            const m = tm.members;
            const avail = availMap.get(tm.member_id) ?? 'unknown';
            const isSelected = selected.has(tm.member_id);
            const isUnavailable = avail === 'unavailable';

            return (
              <button
                key={tm.member_id}
                onClick={() => toggle(tm.member_id)}
                className={`flex items-center justify-between w-full rounded-md px-3 py-2 transition-colors text-left ${
                  isSelected
                    ? 'bg-primary/10 border border-primary/20'
                    : isUnavailable
                      ? 'opacity-50 hover:bg-muted'
                      : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono w-5">{tm.position}</span>
                  {AVAIL_ICON[avail]}
                  <span className="text-sm font-medium">{m.last_name}, {m.first_name}</span>
                  {m.ttr_rating && (
                    <span className="text-xs text-muted-foreground">TTR {m.ttr_rating}</span>
                  )}
                </div>
                {isSelected ? (
                  <Badge variant="default" className="gap-1">
                    <UserMinus className="h-3 w-3" /> Aufgestellt
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <UserPlus className="h-3 w-3" /> Auswählen
                  </Badge>
                )}
              </button>
            );
          })}
          {!teamMembers?.length && (
            <p className="text-sm text-muted-foreground text-center py-4">Keine Spieler im Team</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
