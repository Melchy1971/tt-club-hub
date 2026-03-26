import { Users, Shield, Swords, TrendingUp } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';

export default function Dashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">Übersicht über deinen Verein</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Mitglieder"
          value={0}
          subtitle="Aktive Mitglieder"
          icon={Users}
        />
        <StatCard
          title="Mannschaften"
          value={0}
          subtitle="Aktive Teams"
          icon={Shield}
        />
        <StatCard
          title="Begegnungen"
          value={0}
          subtitle="Anstehende Spiele"
          icon={Swords}
        />
        <StatCard
          title="Siegquote"
          value="–"
          subtitle="Aktuelle Saison"
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="stat-card">
          <h2 className="font-display font-semibold text-lg mb-3">Nächste Begegnungen</h2>
          <p className="text-sm text-muted-foreground">Keine Begegnungen geplant.</p>
        </div>
        <div className="stat-card">
          <h2 className="font-display font-semibold text-lg mb-3">Letzte Ergebnisse</h2>
          <p className="text-sm text-muted-foreground">Keine Ergebnisse vorhanden.</p>
        </div>
      </div>
    </div>
  );
}
