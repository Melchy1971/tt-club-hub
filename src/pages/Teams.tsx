import { Shield, Plus } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';

export default function Teams() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex-row items-center justify-between">
        <div>
          <h1 className="page-title">Mannschaften</h1>
          <p className="page-description">Teams und Aufstellungen verwalten</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Mannschaft erstellen
        </Button>
      </div>

      <EmptyState
        icon={Shield}
        title="Keine Mannschaften"
        description="Erstelle deine erste Mannschaft und ordne Spieler zu."
        actionLabel="Mannschaft erstellen"
        onAction={() => {}}
      />
    </div>
  );
}
