import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AlertTriangle, Trash2 } from 'lucide-react';

export default function SettingsDangerZone() {
  const [confirmText, setConfirmText] = useState('');

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Gefahrenzone
        </CardTitle>
        <CardDescription>Irreversible Aktionen – bitte mit Vorsicht verwenden</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Reset all data (admin only) */}
        <div className="rounded-lg border border-destructive/30 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium">Alle Vereinsdaten löschen</p>
              <p className="text-xs text-muted-foreground">
                Löscht sämtliche Daten (Mitglieder, Teams, Spiele, etc.). Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Gib zur Bestätigung „ALLES LÖSCHEN" ein:
            </Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="ALLES LÖSCHEN"
              className="max-w-xs"
            />
          </div>
          <Button
            variant="destructive"
            size="sm"
            disabled={confirmText !== 'ALLES LÖSCHEN'}
            onClick={() => toast.info('Diese Funktion ist noch nicht implementiert.')}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Alle Daten unwiderruflich löschen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
