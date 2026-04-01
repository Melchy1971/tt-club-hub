import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Star, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { seasonCycleService, seasonPhaseService, type SeasonCycleWithPhases } from '@/services/seasonCycleService';

const PHASE_LABELS: Record<string, string> = {
  first_half: 'Vorrunde',
  second_half: 'Rückrunde',
  single_half: 'Halbrunde',
};

export default function SettingsSeasons() {
  const queryClient = useQueryClient();

  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ['season-cycles'],
    queryFn: seasonCycleService.getAll,
  });

  const togglePhaseMut = useMutation({
    mutationFn: async (id: string) => {
      await seasonPhaseService.toggleActive(id, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['season-cycles'] });
      toast.success('Aktive Phase geändert');
    },
    onError: () => toast.error('Fehler'),
  });

  const deleteCycleMut = useMutation({
    mutationFn: async (id: string) => {
      await seasonCycleService.remove(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['season-cycles'] });
      toast.success('Saisonzyklus gelöscht');
    },
    onError: () => toast.error('Fehler beim Löschen'),
  });

  // Flatten cycles into phase rows for display
  const rows = cycles.flatMap((c) =>
    (c.season_phases ?? []).map((p) => ({ cycle: c, phase: p }))
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saisonverwaltung</CardTitle>
        <CardDescription>Saisonzyklen und aktive Phasen verwalten</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zyklus</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Zeitraum</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Laden…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Keine Saisons</TableCell></TableRow>
              ) : (
                rows.map(({ cycle, phase }) => (
                  <TableRow key={phase.id}>
                    <TableCell className="font-medium">{cycle.name}</TableCell>
                    <TableCell>{phase.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{PHASE_LABELS[phase.phase_type] ?? phase.phase_type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(phase.start_date), 'dd.MM.yyyy')} – {format(new Date(phase.end_date), 'dd.MM.yyyy')}
                    </TableCell>
                    <TableCell>
                      {phase.is_active ? (
                        <Badge className="bg-success text-success-foreground">Aktiv</Badge>
                      ) : (
                        <Badge variant="secondary">Inaktiv</Badge>
                      )}
                    </TableCell>
                    <TableCell className="flex gap-1">
                      {!phase.is_active && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => togglePhaseMut.mutate(phase.id)}>
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
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
