import { Users, Shield, Swords, TrendingUp, CalendarDays, Repeat2, Dumbbell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StatCard } from '@/components/common/StatCard';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function Dashboard() {
  const today = new Date().toISOString().split('T')[0];

  const { data: memberCount = 0 } = useQuery({
    queryKey: ['dashboard-members'],
    queryFn: async () => {
      const { count } = await supabase.from('members').select('*', { count: 'exact', head: true }).eq('is_active', true);
      return count ?? 0;
    },
  });

  const { data: teamCount = 0 } = useQuery({
    queryKey: ['dashboard-teams'],
    queryFn: async () => {
      const { count } = await supabase.from('teams').select('*', { count: 'exact', head: true }).eq('is_active', true);
      return count ?? 0;
    },
  });

  const { data: upcomingMatches = [] } = useQuery({
    queryKey: ['dashboard-upcoming'],
    queryFn: async () => {
      const { data } = await supabase
        .from('schedule_matches')
        .select('id, match_date, match_time, home_team, away_team, is_home, status, team_id')
        .gte('match_date', today)
        .in('status', ['geplant', 'verschoben'])
        .order('match_date', { ascending: true })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: recentResults = [] } = useQuery({
    queryKey: ['dashboard-results'],
    queryFn: async () => {
      const { data } = await supabase
        .from('schedule_matches')
        .select('id, match_date, home_team, away_team, home_score, away_score, is_home')
        .eq('status', 'beendet')
        .order('match_date', { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: substituteCount = 0 } = useQuery({
    queryKey: ['dashboard-substitutes'],
    queryFn: async () => {
      const { count } = await supabase.from('substitute_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      return count ?? 0;
    },
  });

  const { data: trainingCount = 0 } = useQuery({
    queryKey: ['dashboard-training'],
    queryFn: async () => {
      const { count } = await supabase.from('training_bookings').select('*', { count: 'exact', head: true }).gte('booking_date', today).eq('status', 'confirmed');
      return count ?? 0;
    },
  });

  // Win rate
  const winRate = (() => {
    if (!recentResults.length) return '–';
    const totalFinished = recentResults.length;
    const wins = recentResults.filter((m) => {
      if (m.home_score == null || m.away_score == null) return false;
      return m.is_home ? m.home_score > m.away_score : m.away_score > m.home_score;
    }).length;
    return totalFinished > 0 ? `${Math.round((wins / totalFinished) * 100)}%` : '–';
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">Übersicht über deinen Verein</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Mitglieder"
          value={memberCount}
          subtitle="Aktive Mitglieder"
          icon={Users}
        />
        <StatCard
          title="Mannschaften"
          value={teamCount}
          subtitle="Aktive Teams"
          icon={Shield}
        />
        <StatCard
          title="Begegnungen"
          value={upcomingMatches.length}
          subtitle="Anstehende Spiele"
          icon={Swords}
        />
        <StatCard
          title="Siegquote"
          value={winRate}
          subtitle="Aktuelle Saison"
          icon={TrendingUp}
        />
        <StatCard
          title="Ersatzanfragen"
          value={substituteCount}
          subtitle="Offene Anfragen"
          icon={Repeat2}
        />
        <StatCard
          title="Training"
          value={trainingCount}
          subtitle="Kommende Buchungen"
          icon={Dumbbell}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="stat-card">
          <h2 className="font-display font-semibold text-lg mb-3">Nächste Begegnungen</h2>
          {upcomingMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Begegnungen geplant.</p>
          ) : (
            <ul className="space-y-2">
              {upcomingMatches.map((m) => (
                <li key={m.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{m.home_team} – {m.away_team}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {format(new Date(m.match_date), 'dd.MM.yyyy', { locale: de })}
                    {m.match_time ? `, ${m.match_time.slice(0, 5)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="stat-card">
          <h2 className="font-display font-semibold text-lg mb-3">Letzte Ergebnisse</h2>
          {recentResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Ergebnisse vorhanden.</p>
          ) : (
            <ul className="space-y-2">
              {recentResults.map((m) => (
                <li key={m.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span className="font-medium">{m.home_team} – {m.away_team}</span>
                  <span className="font-semibold">{m.home_score ?? '–'}:{m.away_score ?? '–'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
