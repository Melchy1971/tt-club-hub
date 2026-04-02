import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Minus } from 'lucide-react';
import { toast } from 'sonner';
import type { ScheduleMatch, Member } from '@/types';

type AvailabilityStatus = 'available' | 'unavailable' | 'unknown';

interface Props {
  match: ScheduleMatch;
  teamId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_CONFIG: Record<AvailabilityStatus, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  available: { label: 'Verfügbar', icon: <Check className="h-3.5 w-3.5" />, variant: 'default' },
  unavailable: { label: 'Nicht verfügbar', icon: <X className="h-3.5 w-3.5" />, variant: 'destructive' },
    unknown: { label: 'Unbekannt', icon: <Minus className="h-3.5 w-3.5" />, variant: 'outline' },
};

const CYCLE: AvailabilityStatus[] = ['unknown', 'available', 'unavailable'];

export function AvailabilityDialog({ match, teamId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [statuses, setStatuses] = useState<Record<string, AvailabilityStatus>>({});

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

  // Existing availability
  const { data: existing } = useQuery({
    queryKey: ['match-availability', match.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_availability')
        .select('*')
        .eq('match_id', match.id);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (existing) {
      const map: Record<string, AvailabilityStatus> = {};
      existing.forEach((a) => {
        map[a.member_id] = a.status as AvailabilityStatus;
      });
      setStatuses(map);
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!teamMembers) return;
      for (const tm of teamMembers) {
        const status = statuses[tm.member_id] ?? 'unknown';
        const { error } = await supabase
          .from('match_player_availability' as never)
          .upsert(
            { match_id: match.id, member_id: tm.member_id, team_id: teamId, status },
            { onConflict: 'match_id,member_id' }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-availability', match.id] });
      toast.success('Verfügbarkeiten gespeichert');
      onOpenChange(false);
    },
    onError: () => toast.error('Fehler beim Speichern'),
  });

  const toggleStatus = (memberId: string) => {
    setStatuses((prev) => {
      const current = prev[memberId] ?? 'unknown';
      const nextIdx = (CYCLE.indexOf(current) + 1) % CYCLE.length;
      return { ...prev, [memberId]: CYCLE[nextIdx] };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Verfügbarkeiten</DialogTitle>
          <DialogDescription>
            {match.home_team} – {match.away_team}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {teamMembers?.map((tm) => {
            const m = tm.members;
            const status = statuses[tm.member_id] ?? 'unknown';
            const cfg = STATUS_CONFIG[status];
            return (
              <button
                key={tm.member_id}
                onClick={() => toggleStatus(tm.member_id)}
                className="flex items-center justify-between w-full rounded-md px-3 py-2 hover:bg-muted transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono w-5">{tm.position}</span>
                  <span className="text-sm font-medium">{m.last_name}, {m.first_name}</span>
                  {m.ttr_rating && (
                    <span className="text-xs text-muted-foreground">TTR {m.ttr_rating}</span>
                  )}
                </div>
                <Badge variant={cfg.variant} className="gap-1 min-w-[110px] justify-center">
                  {cfg.icon} {cfg.label}
                </Badge>
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
