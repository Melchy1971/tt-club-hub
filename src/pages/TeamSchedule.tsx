import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Edit, Trophy, Home, Plane, MapPin, KeyRound, Users, ClipboardList, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EditResultDialog } from '@/components/schedule/EditResultDialog';
import { EditMatchDialog } from '@/components/schedule/EditMatchDialog';
import { BulkPinCodeDialog } from '@/components/schedule/BulkPinCodeDialog';
import { AvailabilityDialog } from '@/components/schedule/AvailabilityDialog';
import { LineupDialog } from '@/components/schedule/LineupDialog';
import { getMatchStatusLabel } from '@/constants/uiLabels';
import type { ScheduleMatch, ScheduleMatchUpdate } from '@/types';

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  geplant: 'outline',
  laufend: 'default',
  beendet: 'secondary',
  verschoben: 'destructive',
  abgesagt: 'destructive',
};

function formatGermanDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function formatTime(time: string | null): string {
  if (!time) return '–';
  return time.slice(0, 5);
}

export default function TeamSchedule() {
  const { teamId } = useParams<{ teamId: string }>();
  const queryClient = useQueryClient();
  const [editResultMatch, setEditResultMatch] = useState<ScheduleMatch | null>(null);
  const [editMatch, setEditMatch] = useState<ScheduleMatch | null>(null);
  const [availabilityMatch, setAvailabilityMatch] = useState<ScheduleMatch | null>(null);
  const [lineupMatch, setLineupMatch] = useState<ScheduleMatch | null>(null);
  const [bulkPinOpen, setBulkPinOpen] = useState(false);
  const [substituteMatch, setSubstituteMatch] = useState<ScheduleMatch | null>(null);
  const { user, member } = useAuth();

  const { data: team } = useQuery({
    queryKey: ['team', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!teamId,
  });

  const { data: matches, isLoading } = useQuery({
    queryKey: ['schedule-matches', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_matches')
        .select('*')
        .eq('team_id', teamId!)
        .order('match_date', { ascending: true });
      if (error) throw error;
      return data as ScheduleMatch[];
    },
    enabled: !!teamId,
  });

  const { data: venues } = useQuery({
    queryKey: ['venues'],
    queryFn: async () => {
      const { data, error } = await supabase.from('venues').select('*');
      if (error) throw error;
      return data;
    },
  });

  const venueMap = new Map((venues ?? []).map((v) => [v.id, v]));

  // Fetch team members for substitute request
  const { data: teamMembers } = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('member_id, members(id, first_name, last_name)')
        .eq('team_id', teamId!);
      if (error) throw error;
      return (data ?? []).map((tm: any) => tm.members).filter(Boolean);
    },
    enabled: !!teamId,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ScheduleMatchUpdate }) => {
      const { error } = await supabase
        .from('schedule_matches')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-matches', teamId] });
      toast.success('Gespeichert');
    },
    onError: () => toast.error('Fehler beim Speichern'),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: { id: string; pin: string | null; code: string | null }[]) => {
      for (const u of updates) {
        const { error } = await supabase
          .from('schedule_matches')
          .update({ pin: u.pin, code: u.code })
          .eq('id', u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-matches', teamId] });
      toast.success('Pins/Codes aktualisiert');
    },
    onError: () => toast.error('Fehler beim Speichern'),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/spielplan">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="page-title">{team?.name ?? 'Spielplan'}</h1>
            <p className="page-description">
              {team?.league}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setBulkPinOpen(true)}>
          <KeyRound className="mr-2 h-4 w-4" />
          Pins & Codes
        </Button>
      </div>

      {/* Matches table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-md" />
          ))}
        </div>
      ) : !matches?.length ? (
        <p className="text-muted-foreground text-center py-12">Keine Begegnungen vorhanden.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">ST</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Zeit</TableHead>
                <TableHead>H/A</TableHead>
                <TableHead>Begegnung</TableHead>
                <TableHead>Spiellokal</TableHead>
                <TableHead>Ergebnis</TableHead>
                <TableHead>Pin</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((match) => {
                const venue = match.venue_id ? venueMap.get(match.venue_id) : null;
                return (
                  <TableRow key={match.id}>
                    <TableCell className="font-mono text-muted-foreground">
                      {match.match_day ?? '–'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatGermanDate(match.match_date)}
                    </TableCell>
                    <TableCell>{formatTime(match.match_time)}</TableCell>
                    <TableCell>
                      {match.is_home ? (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <Home className="h-3.5 w-3.5" /> Heim
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Plane className="h-3.5 w-3.5" /> Auswärts
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={match.is_home ? 'font-semibold' : ''}>
                        {match.home_team}
                      </span>
                      {' – '}
                      <span className={!match.is_home ? 'font-semibold' : ''}>
                        {match.away_team}
                      </span>
                    </TableCell>
                    <TableCell>
                      {venue ? (
                        <span className="inline-flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span>{venue.name}</span>
                          {(venue.street || venue.city) && (
                            <span className="text-muted-foreground text-xs">
                              ({[venue.street, venue.zip_code, venue.city].filter(Boolean).join(', ')})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {match.home_score !== null && match.away_score !== null ? (
                        <button
                          onClick={() => setEditResultMatch(match)}
                          className="inline-flex items-center gap-1 font-mono font-bold hover:text-primary transition-colors"
                        >
                          <Trophy className="h-3.5 w-3.5" />
                          {match.home_score}:{match.away_score}
                        </button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditResultMatch(match)}
                          className="text-muted-foreground"
                        >
                          Eintragen
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {match.pin ? (
                        <Badge variant="outline" className="font-mono text-xs">{match.pin}</Badge>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {match.code ? (
                        <Badge variant="outline" className="font-mono text-xs">{match.code}</Badge>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[match.status] ?? 'outline'}>
                        {getMatchStatusLabel(match.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setSubstituteMatch(match)}>
                                <UserPlus className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ersatzanfrage</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setAvailabilityMatch(match)}>
                                <Users className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Verfügbarkeiten</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setLineupMatch(match)}>
                                <ClipboardList className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Aufstellung</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setEditMatch(match)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Bearbeiten</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialogs */}
      {editResultMatch && (
        <EditResultDialog
          match={editResultMatch}
          open={!!editResultMatch}
          onOpenChange={(open) => !open && setEditResultMatch(null)}
          onSave={(homeScore, awayScore) => {
            updateMutation.mutate({
              id: editResultMatch.id,
              updates: { home_score: homeScore, away_score: awayScore, status: 'beendet' },
            });
            setEditResultMatch(null);
          }}
        />
      )}

      {editMatch && (
        <EditMatchDialog
          match={editMatch}
          venues={venues ?? []}
          open={!!editMatch}
          onOpenChange={(open) => !open && setEditMatch(null)}
          onSave={(updates) => {
            updateMutation.mutate({ id: editMatch.id, updates });
            setEditMatch(null);
          }}
        />
      )}

      <BulkPinCodeDialog
        matches={matches ?? []}
        open={bulkPinOpen}
        onOpenChange={setBulkPinOpen}
        onSave={(updates) => {
          bulkUpdateMutation.mutate(updates);
          setBulkPinOpen(false);
        }}
      />

      {availabilityMatch && teamId && (
        <AvailabilityDialog
          match={availabilityMatch}
          teamId={teamId}
          open={!!availabilityMatch}
          onOpenChange={(open) => !open && setAvailabilityMatch(null)}
        />
      )}

      {lineupMatch && teamId && (
        <LineupDialog
          match={lineupMatch}
          teamId={teamId}
          open={!!lineupMatch}
          onOpenChange={(open) => !open && setLineupMatch(null)}
        />
      )}

      {substituteMatch && teamId && (
        <SubstituteRequestDialog
          match={substituteMatch}
          teamId={teamId}
          teamName={team?.name ?? ''}
          members={teamMembers ?? []}
          open={!!substituteMatch}
          onOpenChange={(open) => { if (!open) setSubstituteMatch(null); }}
          userId={user?.id ?? ''}
        />
      )}
    </div>
  );
}

// ─── Inline Substitute Request Dialog ────────────────────────────────────────

interface SubstituteDialogProps {
  match: ScheduleMatch;
  teamId: string;
  teamName: string;
  members: { id: string; first_name: string; last_name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

function SubstituteRequestDialog({ match, teamId, teamName, members, open, onOpenChange, userId }: SubstituteDialogProps) {
  const [memberId, setMemberId] = useState('');
  const [note, setNote] = useState('');
  const queryClient = useQueryClient();

  const createMut = useMutation({
    mutationFn: async () => {
      if (!memberId) throw new Error('Spieler wählen');
      const { error } = await supabase.from('substitute_requests').insert({
        match_id: match.id,
        team_id: teamId,
        requesting_member_id: memberId,
        created_by: userId,
        note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['substitute-requests'] });
      toast.success('Ersatzanfrage erstellt');
      setMemberId('');
      setNote('');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || 'Fehler'),
  });

  function formatGD(iso: string) {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ersatzanfrage erstellen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border p-3 bg-muted/50 text-sm space-y-1">
            <p className="font-medium">{match.home_team} – {match.away_team}</p>
            <p className="text-muted-foreground">{formatGD(match.match_date)} · {teamName}</p>
          </div>
          <div className="space-y-2">
            <Label>Fehlender Spieler</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Spieler wählen" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.last_name}, {m.first_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notiz (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="z.B. Grund der Abwesenheit" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={() => createMut.mutate()} disabled={!memberId || createMut.isPending}>Erstellen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
