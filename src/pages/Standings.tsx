import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getAgeGroupLabel } from '@/constants/uiLabels';

interface TeamStanding {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

function computeStandings(
  matches: {
    team_id: string;
    home_team: string;
    away_team: string;
    home_score: number | null;
    away_score: number | null;
    status: string;
    is_home: boolean;
  }[],
  teamName: string,
): TeamStanding[] {
  const map = new Map<string, TeamStanding>();

  const getOrCreate = (name: string, id?: string): TeamStanding => {
    let entry = map.get(name);
    if (!entry) {
      entry = { teamId: id ?? '', teamName: name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
      map.set(name, entry);
    }
    return entry;
  };

  for (const m of matches) {
    if (m.status !== 'beendet' || m.home_score === null || m.away_score === null) continue;

    const home = getOrCreate(m.home_team, m.is_home ? m.team_id : undefined);
    const away = getOrCreate(m.away_team, !m.is_home ? m.team_id : undefined);

    home.played++;
    away.played++;
    home.goalsFor += m.home_score;
    home.goalsAgainst += m.away_score;
    away.goalsFor += m.away_score;
    away.goalsAgainst += m.home_score;

    if (m.home_score > m.away_score) {
      home.won++;
      home.points += 2;
      away.lost++;
    } else if (m.home_score < m.away_score) {
      away.won++;
      away.points += 2;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points += 1;
      away.points += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const diffA = a.goalsFor - a.goalsAgainst;
    const diffB = b.goalsFor - b.goalsAgainst;
    if (diffB !== diffA) return diffB - diffA;
    return b.goalsFor - a.goalsFor;
  });
}

export default function Standings() {
  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['teams-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, age_group, league, division, clicktt_url')
        .eq('is_active', true)
        .order('age_group')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: allMatches, isLoading: matchesLoading } = useQuery({
    queryKey: ['all-schedule-matches-standings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_matches')
        .select('id, team_id, home_team, away_team, home_score, away_score, status, is_home');
      if (error) throw error;
      return data;
    },
  });

  const isLoading = teamsLoading || matchesLoading;

  const teamTables = (teams ?? []).map((team) => {
    const teamMatches = (allMatches ?? []).filter((m) => m.team_id === team.id);
    const standings = computeStandings(teamMatches, team.name);
    return { team, standings };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Tabelle</h1>
        <p className="page-description">
          Tabellenübersicht aller Mannschaften basierend auf den Spielergebnissen.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-md" />
          ))}
        </div>
      ) : teamTables.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Keine Mannschaften vorhanden.</p>
      ) : (
        teamTables.map(({ team, standings }) => (
          <Card key={team.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-primary" />
                {team.name}
                {team.league && (
                  <Badge variant="outline" className="ml-2 font-normal">
                    {team.league}
                  </Badge>
                )}
                <Badge variant="secondary" className="font-normal">
                  {getAgeGroupLabel(team.age_group)}
                </Badge>
                {team.clicktt_url && (
                  <a href={team.clicktt_url} target="_blank" rel="noopener noreferrer" className="ml-auto">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Click-TT
                    </Button>
                  </a>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {standings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine abgeschlossenen Spiele.</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Mannschaft</TableHead>
                        <TableHead className="text-center w-12">Sp.</TableHead>
                        <TableHead className="text-center w-12">S</TableHead>
                        <TableHead className="text-center w-12">U</TableHead>
                        <TableHead className="text-center w-12">N</TableHead>
                        <TableHead className="text-center w-16">Spiele</TableHead>
                        <TableHead className="text-center w-12">Diff.</TableHead>
                        <TableHead className="text-center w-12 font-bold">Pkt.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {standings.map((s, idx) => {
                        const isOwnTeam = s.teamName === team.name;
                        return (
                          <TableRow key={s.teamName} className={isOwnTeam ? 'bg-primary/5 font-medium' : ''}>
                            <TableCell className="font-mono text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className={isOwnTeam ? 'font-semibold text-primary' : ''}>
                              {s.teamName}
                            </TableCell>
                            <TableCell className="text-center">{s.played}</TableCell>
                            <TableCell className="text-center">{s.won}</TableCell>
                            <TableCell className="text-center">{s.drawn}</TableCell>
                            <TableCell className="text-center">{s.lost}</TableCell>
                            <TableCell className="text-center font-mono">
                              {s.goalsFor}:{s.goalsAgainst}
                            </TableCell>
                            <TableCell className="text-center font-mono">
                              {s.goalsFor - s.goalsAgainst > 0 ? '+' : ''}{s.goalsFor - s.goalsAgainst}
                            </TableCell>
                            <TableCell className="text-center font-bold">{s.points}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}