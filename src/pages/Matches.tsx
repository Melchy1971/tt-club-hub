import { Swords, Plus } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';

export default function Matches() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex-row items-center justify-between">
        <div>
          <h1 className="page-title">Spielbetrieb</h1>
          <p className="page-description">Begegnungen, Ergebnisse und Spielberichte</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Begegnung anlegen
        </Button>
      </div>

      <EmptyState
        icon={Swords}
        title="Keine Begegnungen"
        description="Lege die erste Begegnung an, um den Spielbetrieb zu starten."
        actionLabel="Begegnung anlegen"
        onAction={() => {}}
      />
    </div>
  );
}
