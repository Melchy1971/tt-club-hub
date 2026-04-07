import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSeason } from '@/contexts/SeasonContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus, Inbox, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { CreateRequestDialog } from '@/components/substitutes/CreateRequestDialog';
import { SelectPlayerDialog } from '@/components/substitutes/SelectPlayerDialog';
import { getSubstituteStatusLabel } from '@/constants/uiLabels';
import type { ScheduleMatch, Member, Team } from '@/types';

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  accepted: 'default',
  rejected: 'destructive',
};

function formatGermanDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

interface SubstituteRequest {
  id: string;
  match_id: string;
  team_id: string;
  requesting_member_id: string;
  substitute_member_id: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export default function Substitutes() {
  const { currentSeason } = useSeason();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectPlayerReq, setSelectPlayerReq] = useState<SubstituteRequest | null>(null);

  // Fetch all matches with unavailable players for current season
  const { data: matches } = useQuery({
    queryKey: ['schedule-matches-season', currentSeason?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_matches')
        .select('*')
        .eq('season_id', currentSeason!.id)
        .in('status', ['geplant', 'laufend'])
        .order('match_date', { ascending: true });
      if (error) throw error;
      return data as ScheduleMatch[];
    },
    enabled: !!currentSeason?.id,
  });

  const { data: teams } = useQuery({
    queryKey: ['teams', currentSeason?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('season_id', currentSeason!.id);
      if (error) throw error;
      return data as Team[];
    },
    enabled: !!currentSeason?.id,
  });

  const { data: members } = useQuery({
    queryKey: ['members-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('is_active', true)
        .order('last_name');
      if (error) throw error;
      return data as Member[];
    },
  });

  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ['substitute-requests', currentSeason?.id],
    queryFn: async () => {
      if (!matches?.length) return [];
      const matchIds = matches.map((m) => m.id);
      const { data, error } = await supabase
        .from('substitute_requests')
        .select('*')
        .in('match_id', matchIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as SubstituteRequest[];
    },
    enabled: !!matches?.length,
  });

  const { data: unavailabilities } = useQuery({
    queryKey: ['unavailabilities', currentSeason?.id],
    queryFn: async () => {
      if (!matches?.length) return [];
      const matchIds = matches.map((m) => m.id);
      const { data, error } = await supabase
        .from('match_availability')
        .select('*')
        .in('match_id', matchIds)
        .eq('status', 'unavailable');
      if (error) throw error;
      return data;
    },
    enabled: !!matches?.length,
  });

  const teamMap = new Map((teams ?? []).map((t) => [t.id, t]));
  const memberMap = new Map((members ?? []).map((m) => [m.id, m]));
  const matchMap = new Map((matches ?? []).map((m) => [m.id, m]));

  // Matches that have unavailable players
  const matchesWithUnavailable = (matches ?? []).filter((m) =>
    (unavailabilities ?? []).some((u) => u.match_id === m.id)
  );

  // Pending requests (needing a substitute player)
  const pendingRequests = (requests ?? []).filter((r) => r.status === 'pending');
  const incomingRequests = (requests ?? []).filter((r) => r.status !== 'pending' || r.substitute_member_id);

  const createMutation = useMutation({
    mutationFn: async (input: { match_id: string; team_id: string; requesting_member_id: string; note?: string }) => {
      const { error } = await supabase.from('substitute_requests').insert({
        match_id: input.match_id,
        team_id: input.team_id,
        requesting_member_id: input.requesting_member_id,
        note: input.note || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['substitute-requests'] });
      toast.success('Ersatzanfrage erstellt');
    },
    onError: () => toast.error('Fehler beim Erstellen'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SubstituteRequest> }) => {
      const { error } = await supabase
        .from('substitute_requests')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['substitute-requests'] });
      toast.success('Status aktualisiert');
    },
    onError: () => toast.error('Fehler beim Aktualisieren'),
  });

  const handleAssignSubstitute = (reqId: string, memberId: string) => {
    updateMutation.mutate({ id: reqId, updates: { substitute_member_id: memberId } });
    setSelectPlayerReq(null);
  };

  const handleAccept = (reqId: string) => {
    updateMutation.mutate({ id: reqId, updates: { status: 'accepted' as any } });
  };

  const handleReject = (reqId: string) => {
    updateMutation.mutate({ id: reqId, updates: { status: 'rejected' as any } });
  };

  const getMemberName = (id: string) => {
    const m = memberMap.get(id);
    return m ? `${m.first_name} ${m.last_name}` : '–';
  };

  const getMatchLabel = (matchId: string) => {
    const m = matchMap.get(matchId);
    if (!m) return '–';
    return `${m.home_team} – ${m.away_team} (${formatGermanDate(m.match_date)})`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex-row items-center justify-between">
        <div>
          <h1 className="page-title">Ersatzstellung</h1>
          <p className="page-description">Ersatzanfragen für nicht verfügbare Spieler verwalten</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Ersatzanfrage
        </Button>
      </div>

      <Tabs defaultValue="needed" className="w-full">
        <TabsList>
          <TabsTrigger value="needed">
            Ersatz benötigt
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingRequests.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="incoming">
            <Inbox className="mr-1.5 h-3.5 w-3.5" />
            Eingehende Anfragen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="needed">
          {requestsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-md" />
              ))}
            </div>
          ) : !pendingRequests.length && !matchesWithUnavailable.length ? (
            <p className="text-muted-foreground text-center py-12">Keine offenen Ersatzanfragen.</p>
          ) : (
            <div className="space-y-4">
              {/* Matches with unavailable players without requests yet */}
              {matchesWithUnavailable.length > 0 && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Spiel</TableHead>
                        <TableHead>Mannschaft</TableHead>
                        <TableHead>Nicht verfügbar</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matchesWithUnavailable.map((match) => {
                        const unavail = (unavailabilities ?? []).filter((u) => u.match_id === match.id);
                        const team = teamMap.get(match.team_id);
                        return (
                          <TableRow key={match.id}>
                            <TableCell className="font-medium">
                              {match.home_team} – {match.away_team}
                              <span className="block text-xs text-muted-foreground">
                                {formatGermanDate(match.match_date)}
                              </span>
                            </TableCell>
                            <TableCell>{team?.name ?? '–'}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {unavail.map((u) => (
                                  <Badge key={u.id} variant="destructive" className="text-xs">
                                    {getMemberName(u.member_id)}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  // Pre-fill create dialog is handled by opening it
                                  setCreateOpen(true);
                                }}
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pending requests */}
              {pendingRequests.length > 0 && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Spiel</TableHead>
                        <TableHead>Spieler (fehlt)</TableHead>
                        <TableHead>Ersatzspieler</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notiz</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingRequests.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="font-medium text-sm">
                            {getMatchLabel(req.match_id)}
                          </TableCell>
                          <TableCell>{getMemberName(req.requesting_member_id)}</TableCell>
                          <TableCell>
                            {req.substitute_member_id ? (
                              getMemberName(req.substitute_member_id)
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectPlayerReq(req)}
                              >
                                Auswählen
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANTS[req.status]}>{getSubstituteStatusLabel(req.status)}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{req.note ?? '–'}</TableCell>
                          <TableCell>
                            {req.substitute_member_id && (
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" onClick={() => handleAccept(req.id)}>
                                  <Check className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => handleReject(req.id)}>
                                  <X className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="incoming">
          {requestsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-md" />
              ))}
            </div>
          ) : !(requests ?? []).length ? (
            <p className="text-muted-foreground text-center py-12">Keine Anfragen vorhanden.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Spiel</TableHead>
                    <TableHead>Spieler (fehlt)</TableHead>
                    <TableHead>Ersatzspieler</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notiz</TableHead>
                    <TableHead>Erstellt</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(requests ?? []).map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium text-sm">
                        {getMatchLabel(req.match_id)}
                      </TableCell>
                      <TableCell>{getMemberName(req.requesting_member_id)}</TableCell>
                      <TableCell>
                        {req.substitute_member_id ? getMemberName(req.substitute_member_id) : '–'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[req.status]}>{getSubstituteStatusLabel(req.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{req.note ?? '–'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatGermanDate(req.created_at.slice(0, 10))}
                      </TableCell>
                      <TableCell>
                        {req.status === 'pending' && (
                          <div className="flex gap-1">
                            {!req.substitute_member_id && (
                              <Button size="sm" variant="outline" onClick={() => setSelectPlayerReq(req)}>
                                <UserPlus className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {req.substitute_member_id && (
                              <>
                                <Button size="icon" variant="ghost" onClick={() => handleAccept(req.id)}>
                                  <Check className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => handleReject(req.id)}>
                                  <X className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateRequestDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        matches={matches ?? []}
        teams={teams ?? []}
        members={members ?? []}
        unavailabilities={unavailabilities ?? []}
        onSave={(data) => {
          createMutation.mutate(data);
          setCreateOpen(false);
        }}
      />

      {selectPlayerReq && (
        <SelectPlayerDialog
          open={!!selectPlayerReq}
          onOpenChange={(open) => !open && setSelectPlayerReq(null)}
          members={members ?? []}
          matchId={selectPlayerReq.match_id}
          onSelect={(memberId) => handleAssignSubstitute(selectPlayerReq.id, memberId)}
        />
      )}
    </div>
  );
}
