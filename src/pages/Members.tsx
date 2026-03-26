import { Users, Plus } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';

export default function Members() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex-row items-center justify-between">
        <div>
          <h1 className="page-title">Mitglieder</h1>
          <p className="page-description">Vereinsmitglieder verwalten</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Mitglied hinzufügen
        </Button>
      </div>

      <EmptyState
        icon={Users}
        title="Keine Mitglieder"
        description="Füge dein erstes Vereinsmitglied hinzu, um loszulegen."
        actionLabel="Mitglied hinzufügen"
        onAction={() => {}}
      />
    </div>
  );
}
