import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Einstellungen</h1>
        <p className="page-description">Vereins- und Systemeinstellungen</p>
      </div>

      <div className="stat-card">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Settings className="h-5 w-5" />
          <p className="text-sm">Einstellungen werden in einer zukünftigen Version verfügbar sein.</p>
        </div>
      </div>
    </div>
  );
}
