import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamService } from '@/services/teamService';
import { matchService, formatVenueAddress } from '@/services/matchService';
import { isOk } from '@/lib/api';
import { formatDate } from '@/lib/date';
import { useToast } from '@/hooks/use-toast';
import type { ScheduleMatchFull } from '@/services/matchService';
import type { MatchResultInput } from '@/schemas/match.schema';
import type { PinCodeEntry } from '@/schemas/match.schema';
import type { EditMatchFormData } from '@/components/schedule/EditMatchDialog';

import { MatchStatusBadge } from '@/components/schedule/MatchStatusBadge';
import { HomeAwayBadge } from '@/components/schedule/HomeAwayBadge';
import { EditResultDialog } from '@/components/schedule/EditResultDialog';
import { EditMatchDialog } from '@/components/schedule/EditMatchDialog';
import { BulkPinCodeDialog } from '@/components/schedule/BulkPinCodeDialog';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  Pencil,
  Trophy,
  Hash,
  Ban,
} from 'lucide-react';

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function formatScore(home: number | null, away: number | null): string {
  if (home == null || away == null) return '–';
  return `${home} : ${away}`;
}

function formatMatchTime(time: string | null | undefined): string {
  if (!time) return '–';
  return time.slice(0, 5); // "HH:MM:SS" → "HH:MM"
}

// ─── Seite ───────────────────────────────────────────────────────────────────

export default function ScheduleTeam() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [resultMatch, setResultMatch] = useState<ScheduleMatchFull | null>(null);
  const [editMatch, setEditMatch] = useState<ScheduleMatchFull | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  // ─── Queries ─────────────────────────────────────────────────────────────

  const teamQuery = useQuery({
    queryKey: ['team', teamId],
    queryFn: async () => {
      const result = await teamService.getById(teamId!);
      if (!isOk(result)) throw new Error(result.error.message);
      return result.data;
    },
    enabled: !!teamId,
  });

  const matchesQuery = useQuery({
    queryKey: ['matches', 'team', teamId, 'full'],
    queryFn: () => matchService.getByTeamWithVenue(teamId!),
    enabled: !!teamId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['matches', 'team', teamId] });

  // ─── Mutations ───────────────────────────────────────────────────────────

  const resultMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: MatchResultInput }) =>
      matchService.update(id, data),
    onSuccess: () => {
      toast({ title: 'Ergebnis gespeichert' });
      setResultMatch(null);
      void invalidate();
    },
    onError: (e: Error) => {
      toast({ variant: 'destructive', title: 'Fehler', description: e.message });
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditMatchFormData }) =>
      matchService.update(id, {
        match_day: data.match_day ?? null,
        match_date: data.match_date,
        match_time: data.match_time ? `${data.match_time}:00` : null,
        home_team: data.home_team,
        away_team: data.away_team,
        is_home: data.is_home,
        status: data.status,
        pin: data.pin ?? null,
        code: data.code ?? null,
        report_text: data.report_text ?? null,
      }),
    onSuccess: () => {
      toast({ title: 'Spiel gespeichert' });
      setEditMatch(null);
      void invalidate();
    },
    onError: (e: Error) => {
      toast({ variant: 'destructive', title: 'Fehler', description: e.message });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (entries: PinCodeEntry[]) => {
      await Promise.all(
        entries.map((e) => matchService.update(e.id, { pin: e.pin, code: e.code })),
      );
    },
    onSuccess: () => {
      toast({ title: 'PIN & Code gespeichert' });
      setBulkOpen(false);
      void invalidate();
    },
    onError: (e: Error) => {
      toast({ variant: 'destructive', title: 'Fehler', description: e.message });
    },
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  const team = teamQuery.data;
  const matches = matchesQuery.data ?? [];
  const isLoading = teamQuery.isLoading || matchesQuery.isLoading;
  const isError = teamQuery.isError || matchesQuery.isError;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (isError || !team) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-3 text-center h-64">
        <Ban className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">Mannschaft nicht gefunden.</p>
        <Button variant="outline" onClick={() => navigate('/spielbetrieb')}>
          Zurück zur Übersicht
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link
          to="/spielbetrieb"
          className="hover:text-foreground transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Spielplan
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{team.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight">{team.name}</h1>
          {team.league && (
            <p className="text-muted-foreground text-sm">
              {team.league}
              {team.division ? ` · ${team.division}` : ''}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBulkOpen(true)}
          disabled={matches.length === 0}
          className="gap-1.5"
        >
          <Hash className="h-4 w-4" />
          PIN &amp; Code
        </Button>
      </div>

      {/* Tabelle */}
      {matches.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 text-center h-48 border rounded-xl">
          <CalendarDays className="h-9 w-9 text-muted-foreground" />
          <p className="text-muted-foreground">Noch keine Spiele für diese Mannschaft.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 text-right">#</TableHead>
                <TableHead className="min-w-[110px]">Datum</TableHead>
                <TableHead className="w-[60px]">Zeit</TableHead>
                <TableHead className="w-[80px]">H/A</TableHead>
                <TableHead className="min-w-[160px]">Heimmannschaft</TableHead>
                <TableHead className="min-w-[160px]">Gastmannschaft</TableHead>
                <TableHead className="w-[80px] text-center">Ergebnis</TableHead>
                <TableHead className="w-[90px]">Status</TableHead>
                <TableHead className="min-w-[130px]">Spiellokal</TableHead>
                <TableHead className="w-[90px] font-mono text-xs">PIN</TableHead>
                <TableHead className="w-[110px] font-mono text-xs">Code</TableHead>
                <TableHead className="w-[80px] text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((match) => {
                const venueText = formatVenueAddress(match.venues);
                return (
                  <TableRow key={match.id} className="group">
                    {/* Spieltag */}
                    <TableCell className="text-right text-muted-foreground text-sm tabular-nums">
                      {match.match_day ?? '–'}
                    </TableCell>

                    {/* Datum */}
                    <TableCell className="whitespace-nowrap text-sm">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {formatDate(match.match_date)}
                      </span>
                    </TableCell>

                    {/* Zeit */}
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0" />
                        {formatMatchTime(match.match_time)}
                      </span>
                    </TableCell>

                    {/* Heim/Auswärts */}
                    <TableCell>
                      <HomeAwayBadge isHome={match.is_home} />
                    </TableCell>

                    {/* Heim */}
                    <TableCell className="font-medium text-sm max-w-[180px] truncate">
                      {match.home_team}
                    </TableCell>

                    {/* Gast */}
                    <TableCell className="text-sm max-w-[180px] truncate">
                      {match.away_team}
                    </TableCell>

                    {/* Ergebnis */}
                    <TableCell className="text-center">
                      <span
                        className={`font-mono font-bold tabular-nums text-sm ${
                          match.home_score != null ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {formatScore(match.home_score, match.away_score)}
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <MatchStatusBadge status={match.status} />
                    </TableCell>

                    {/* Spiellokal */}
                    <TableCell className="text-sm text-muted-foreground max-w-[150px]">
                      {venueText ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 cursor-default truncate">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{match.venues?.name ?? '–'}</span>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs">{venueText}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground/50">–</span>
                      )}
                    </TableCell>

                    {/* PIN */}
                    <TableCell>
                      {match.pin ? (
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                          {match.pin}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50 text-xs">–</span>
                      )}
                    </TableCell>

                    {/* Code */}
                    <TableCell>
                      {match.code ? (
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                          {match.code}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50 text-xs">–</span>
                      )}
                    </TableCell>

                    {/* Aktionen */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setResultMatch(match)}
                              aria-label="Ergebnis bearbeiten"
                            >
                              <Trophy className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Ergebnis bearbeiten</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setEditMatch(match)}
                              aria-label="Spiel bearbeiten"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Spiel bearbeiten</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialoge */}
      {resultMatch && (
        <EditResultDialog
          match={resultMatch}
          open
          onClose={() => setResultMatch(null)}
          onSave={(id, data) => resultMutation.mutateAsync({ id, data })}
          isSaving={resultMutation.isPending}
        />
      )}

      {editMatch && (
        <EditMatchDialog
          match={editMatch}
          open
          onClose={() => setEditMatch(null)}
          onSave={(id, data) => editMutation.mutateAsync({ id, data })}
          isSaving={editMutation.isPending}
        />
      )}

      <BulkPinCodeDialog
        matches={matches}
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onSave={(entries) => bulkMutation.mutateAsync(entries)}
        isSaving={bulkMutation.isPending}
      />
    </div>
  );
}
