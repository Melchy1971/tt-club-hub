import { CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { useSeason } from '@/contexts/SeasonContext';

interface TeamWithMatchCount {
  id: string;
  name: string;
  league: string | null;
  division: string | null;
  matchCount: number;
  nextMatch: string | null;
}

export default function Schedule() {
  const { currentSeason } = useSeason();

  const { data: teams, isLoading } = useQuery({
    queryKey: ['schedule-teams', currentSeason?.id],
    queryFn: async (): Promise<TeamWithMatchCount[]> => {
      if (!currentSeason?.id) return [];

      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, league, division')
        .eq('season_phase_id', currentSeason.id)
        .eq('is_active', true)
        .order('name');

      if (teamsError) throw teamsError;
      if (!teamsData?.length) return [];

      const teamIds = teamsData.map((t) => t.id);
      const { data: matches, error: matchesError } = await supabase
        .from('schedule_matches')
        .select('team_id, match_date, status')
        .in('team_id', teamIds)
        .order('match_date', { ascending: true });

      if (matchesError) throw matchesError;

      const today = new Date().toISOString().slice(0, 10);

      return teamsData.map((team) => {
        const teamMatches = (matches ?? []).filter((m) => m.team_id === team.id);
        const upcoming = teamMatches.find(
          (m) => m.match_date >= today && m.status !== 'abgesagt',
        );
        return {
          ...team,
          matchCount: teamMatches.length,
          nextMatch: upcoming?.match_date ?? null,
        };
      });
    },
    enabled: !!currentSeason?.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Spielplan</h1>
          <p className="page-description">Übersicht aller Mannschaften und Begegnungen</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Spielplan</h1>
        <p className="page-description">Übersicht aller Mannschaften und Begegnungen</p>
      </div>

      {!teams?.length ? (
        <EmptyState
          icon={CalendarDays}
          title="Keine Mannschaften"
          description="Es gibt noch keine aktiven Mannschaften in der aktuellen Saison."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Link key={team.id} to={`/spielplan/team/${team.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{team.name}</CardTitle>
                  {team.league && (
                    <p className="text-sm text-muted-foreground">
                      {team.league}
                      {team.division ? ` · ${team.division}` : ''}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <Badge variant="secondary">{team.matchCount} Spiele</Badge>
                  {team.nextMatch && (
                    <span className="text-sm text-muted-foreground">
                      Nächstes: {formatGermanDate(team.nextMatch)}
                    </span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function formatGermanDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
