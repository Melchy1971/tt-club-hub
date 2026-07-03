import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AlertTriangle, Trash2 } from 'lucide-react';

export default function SettingsDangerZone() {
  const [confirmText, setConfirmText] = useState('');
  const [isWiping, setIsWiping] = useState(false);
  const queryClient = useQueryClient();

  const handleWipeAll = async () => {
    setIsWiping(true);
    const { error } = await supabase.rpc('admin_wipe_all_data');
    setIsWiping(false);
    if (error) {
      toast.error('Fehler beim Löschen: ' + error.message);
      return;
    }
    toast.success('Alle Vereinsdaten wurden gelöscht.');
    setConfirmText('');
    queryClient.invalidateQueries();
  };

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
            disabled={confirmText !== 'ALLES LÖSCHEN' || isWiping}
            onClick={handleWipeAll}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isWiping ? 'Lösche…' : 'Alle Daten unwiderruflich löschen'}
          </Button>
        </div>

        {/* Alle Mitglieder löschen */}
        <div className="rounded-lg border border-destructive/30 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium">Alle Mitglieder löschen</p>
              <p className="text-xs text-muted-foreground">
                Löscht alle Mitgliederdaten. Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => toast.info('Diese Funktion ist noch nicht implementiert.')}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Alle Mitglieder löschen
          </Button>
        </div>

        {/* Alle Teams inkl. Spielplan löschen */}
        <div className="rounded-lg border border-destructive/30 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium">Alle Teams inkl. Spielplan löschen</p>
              <p className="text-xs text-muted-foreground">
                Löscht alle Teams sowie den zugehörigen Spielplan. Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => toast.info('Diese Funktion ist noch nicht implementiert.')}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Alle Teams inkl. Spielplan löschen
          </Button>
        </div>

        {/* Spielplan löschen */}
        <div className="rounded-lg border border-destructive/30 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium">Spielplan löschen</p>
              <p className="text-xs text-muted-foreground">
                Löscht den gesamten Spielplan. Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => toast.info('Diese Funktion ist noch nicht implementiert.')}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Spielplan löschen
          </Button>
        </div>

        {/* Pins löschen */}
        <div className="rounded-lg border border-destructive/30 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium">Pins löschen</p>
              <p className="text-xs text-muted-foreground">
                Löscht alle gespeicherten Pins. Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => toast.info('Diese Funktion ist noch nicht implementiert.')}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Pins löschen
          </Button>
        </div>

        {/* QTTR/TTR löschen */}
        <div className="rounded-lg border border-destructive/30 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium">QTTR/TTR löschen</p>
              <p className="text-xs text-muted-foreground">
                Löscht alle QTTR/TTR-Werte der Mitglieder. Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => toast.info('Diese Funktion ist noch nicht implementiert.')}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            QTTR/TTR löschen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
