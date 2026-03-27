import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSeason } from '@/contexts/SeasonContext';
import { teamService } from '@/services/teamService';
import { matchService } from '@/services/matchService';
import { isOk } from '@/lib/api';
import { CalendarDays, ChevronRight, Trophy, Clock, Ban } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Team } from '@/types';

// ─── Typen ───────────────────────────────────────────────────────────────────

interface TeamStats {
  team: Team;
  total: number;
  played: number;
  upcoming: number;
  cancelled: number;
}

// ─── Seite ───────────────────────────────────────────────────────────────────

export default function Schedule() {
  const { currentSeason, isLoading: seasonLoading } = useSeason();
  const navigate = useNavigate();

  const teamsQuery = useQuery({
    queryKey: ['teams', 'active-season'],
    queryFn: async () => {
      const result = await teamService.getByActiveSeason();
      if (!isOk(result)) throw new Error(result.error.message);
      return result.data;
    },
    enabled: !!currentSeason,
  });

  const matchesQuery = useQuery({
    queryKey: ['matches', 'season', currentSeason?.id],
    queryFn: () => matchService.getBySeason(currentSeason!.id),
    enabled: !!currentSeason,
  });

  const teamStats = useMemo<TeamStats[]>(() => {
    const teams = teamsQuery.data ?? [];
    const matches = matchesQuery.data ?? [];

    return teams.map((team) => {
      const teamMatches = matches.filter((m) => m.team_id === team.id);
      return {
        team,
        total: teamMatches.length,
        played: teamMatches.filter((m) => m.status === 'beendet').length,
        upcoming: teamMatches.filter(
          (m) => m.status === 'geplant' || m.status === 'laufend',
        ).length,
        cancelled: teamMatches.filter(
          (m) => m.status === 'abgesagt' || m.status === 'verschoben',
        ).length,
      };
    });
  }, [teamsQuery.data, matchesQuery.data]);

  const isLoading = seasonLoading || teamsQuery.isLoading || matchesQuery.isLoading;
  const isError = teamsQuery.isError || matchesQuery.isError;

  // ─── Render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!currentSeason) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-3 text-center h-64">
        <CalendarDays className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">
          Keine aktive Saison gefunden.
          <br />
          Bitte erst eine Saison als aktiv markieren.
        </p>
        <Button variant="outline" onClick={() => navigate('/saisons')}>
          Zu den Saisons
        </Button>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-3 text-center h-64">
        <Ban className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">Fehler beim Laden der Daten.</p>
        <Button variant="outline" onClick={() => { teamsQuery.refetch(); matchesQuery.refetch(); }}>
          Erneut versuchen
        </Button>
      </div>
    );
  }

  if (teamStats.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-3 text-center h-64">
        <CalendarDays className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">
          Keine Mannschaften in der aktuellen Saison gefunden.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Spielplan</h1>
        <p className="text-muted-foreground">
          Saison{' '}
          <span className="font-medium text-foreground">{currentSeason.name}</span>
          {' · '}
          {teamStats.length} Mannschaft{teamStats.length !== 1 ? 'en' : ''}
        </p>
      </div>

      {/* Mannschafts-Karten */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teamStats.map(({ team, total, played, upcoming, cancelled }) => (
          <Card
            key={team.id}
            className="flex flex-col hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/spielbetrieb/team/${team.id}`)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-tight">{team.name}</CardTitle>
                {!team.is_active && (
                  <Badge variant="outline" className="shrink-0 text-muted-foreground">
                    Inaktiv
                  </Badge>
                )}
              </div>
              {team.league && (
                <p className="text-xs text-muted-foreground">
                  {team.league}
                  {team.division ? ` · ${team.division}` : ''}
                </p>
              )}
            </CardHeader>

            <CardContent className="pb-3 flex-1">
              {total === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Spiele eingetragen.</p>
              ) : (
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Trophy className="h-3.5 w-3.5 text-emerald-500" />
                    <span>
                      <span className="font-semibold text-foreground">{played}</span> beendet
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-blue-500" />
                    <span>
                      <span className="font-semibold text-foreground">{upcoming}</span> offen
                    </span>
                  </div>
                  {cancelled > 0 && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Ban className="h-3.5 w-3.5 text-orange-400" />
                      <span>
                        <span className="font-semibold text-foreground">{cancelled}</span> abges.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>

            <CardFooter className="pt-0">
              <Button variant="outline" size="sm" className="w-full gap-1">
                Zum Spielplan
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
