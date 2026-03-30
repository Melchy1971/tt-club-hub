import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, HelpCircle, UserCheck } from 'lucide-react';
import type { Member } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Member[];
  matchId: string;
  onSelect: (memberId: string) => void;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  available: <CheckCircle className="h-4 w-4 text-green-600" />,
  unavailable: <XCircle className="h-4 w-4 text-destructive" />,
  maybe: <HelpCircle className="h-4 w-4 text-yellow-500" />,
  unknown: <HelpCircle className="h-4 w-4 text-muted-foreground" />,
};

const STATUS_LABEL: Record<string, string> = {
  available: 'Verfügbar',
  unavailable: 'Nicht verfügbar',
  maybe: 'Vielleicht',
  unknown: 'Unbekannt',
};

export function SelectPlayerDialog({ open, onOpenChange, members, matchId, onSelect }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const { data: availabilities } = useQuery({
    queryKey: ['match-availability', matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_availability')
        .select('*')
        .eq('match_id', matchId);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const availMap = new Map((availabilities ?? []).map((a) => [a.member_id, a.status]));

  // Sort: available first, then maybe, then unknown, unavailable last
  const sortOrder: Record<string, number> = { available: 0, maybe: 1, unknown: 2, unavailable: 3 };
  const sortedMembers = [...members].sort((a, b) => {
    const sa = sortOrder[availMap.get(a.id) ?? 'unknown'] ?? 2;
    const sb = sortOrder[availMap.get(b.id) ?? 'unknown'] ?? 2;
    return sa - sb;
  });

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected);
      setSelected(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ersatzspieler auswählen</DialogTitle>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto space-y-1">
          {sortedMembers.map((m) => {
            const status = availMap.get(m.id) ?? 'unknown';
            const isUnavailable = status === 'unavailable';

            return (
              <button
                key={m.id}
                onClick={() => !isUnavailable && setSelected(m.id)}
                disabled={isUnavailable}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left
                  ${selected === m.id ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted'}
                  ${isUnavailable ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {STATUS_ICON[status]}
                <span className="flex-1 font-medium">
                  {m.first_name} {m.last_name}
                </span>
                {m.ttr_rating && (
                  <span className="text-xs text-muted-foreground">TTR {m.ttr_rating}</span>
                )}
                <Badge variant="outline" className="text-xs">
                  {STATUS_LABEL[status]}
                </Badge>
                {selected === m.id && <UserCheck className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleConfirm} disabled={!selected}>
            Zuweisen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
