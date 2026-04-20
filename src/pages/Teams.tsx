import { Shield, Users, ChevronDown, ChevronUp, UserCircle } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

// ─── Typen ───────────────────────────────────────────────────────────────────

interface RosterMember {
  position: number;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    ttr_rating: number | null;
  } | null;
}

interface TeamWithRoster {
  id: string;
  name: string;
  league: string | null;
  age_group: string;
  is_active: boolean;
  roster: RosterMember[];
}

// ─── Altersklassen-Mapping ───────────────────────────────────────────────────

const AGE_GROUP_LABELS: Record<string, string> = {
  herren: 'Herren',
  damen: 'Damen',
  senioren: 'Senioren',
  seniorinnen: 'Seniorinnen',
  jungen_18: 'Jungen U18',
  maedchen_18: 'Mädchen U18',
  jungen_15: 'Jungen U15',
  maedchen_15: 'Mädchen U15',
  jungen_13: 'Jungen U13',
  maedchen_13: 'Mädchen U13',
  jungen_11: 'Jungen U11',
  maedchen_11: 'Mädchen U11',
};

const ADULT_GROUPS = new Set(['herren', 'damen', 'senioren', 'seniorinnen']);

// ─── Data Fetching ───────────────────────────────────────────────────────────

async function fetchTeamsWithRoster(): Promise<TeamWithRoster[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, league, age_group, is_active, team_members(position, members(id, first_name, last_name, ttr_rating))')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;

  return (data ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    league: t.league,
    age_group: t.age_group,
    is_active: t.is_active,
    roster: (t.team_members ?? [])
      .map((tm: any) => ({ position: tm.position, member: tm.members }))
      .sort((a: RosterMember, b: RosterMember) => a.position - b.position),
  }));
}

// ─── Komponenten ─────────────────────────────────────────────────────────────

function TeamCard({ team }: { team: TeamWithRoster }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="cursor-pointer select-none flex flex-row items-center justify-between py-3 px-4"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Shield className="h-5 w-5 text-primary shrink-0" />
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold truncate">{team.name}</CardTitle>
            <div className="flex items-center gap-2 mt-0.5">
              {team.league && (
                <span className="text-xs text-muted-foreground">{team.league}</span>
              )}
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {AGE_GROUP_LABELS[team.age_group] ?? team.age_group}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="text-xs gap-1">
            <Users className="h-3 w-3" />
            {team.roster.length}
          </Badge>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 pb-3 px-4">
          {team.roster.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Keine Spieler zugeordnet</p>
          ) : (
            <div className="grid gap-1">
              {team.roster.map((entry, idx) => (
                <div
                  key={entry.member?.id ?? idx}
                  className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-muted/50 transition-colors text-sm"
                >
                  <span className="w-6 text-center text-xs font-mono text-muted-foreground">
                    {entry.position}
                  </span>
                  <UserCircle className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                  <span className="truncate font-medium">
                    {entry.member ? `${entry.member.first_name} ${entry.member.last_name}` : '—'}
                  </span>
                  {entry.member?.ttr_rating != null && (
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      TTR {entry.member.ttr_rating}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function TeamSection({ title, teams }: { title: string; teams: TeamWithRoster[] }) {
  if (teams.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-display font-semibold text-foreground">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <TeamCard key={team.id} team={team} />
        ))}
      </div>
    </section>
  );
}

// ─── Seite ───────────────────────────────────────────────────────────────────

export default function Teams() {
  const { data: teams, isLoading, error } = useQuery({
    queryKey: ['teams', 'with-roster'],
    queryFn: fetchTeamsWithRoster,
  });

  const adultTeams = (teams ?? []).filter((t) => ADULT_GROUPS.has(t.age_group));
  const youthTeams = (teams ?? []).filter((t) => !ADULT_GROUPS.has(t.age_group));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Mannschaften</h1>
        <p className="page-description">Teams und Aufstellungen verwalten</p>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">Fehler beim Laden der Mannschaften.</p>
      )}

      {!isLoading && !error && (teams?.length ?? 0) === 0 && (
        <EmptyState
          icon={Shield}
          title="Keine Mannschaften"
          description="Erstelle deine erste Mannschaft und ordne Spieler zu."
        />
      )}

      {!isLoading && !error && (teams?.length ?? 0) > 0 && (
        <>
          <TeamSection title="Erwachsene" teams={adultTeams} />
          <TeamSection title="Jugend" teams={youthTeams} />
        </>
      )}
    </div>
  );
}
