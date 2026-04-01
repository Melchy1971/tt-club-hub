import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { AlertTriangle, Trash2, UserX } from 'lucide-react';

export default function SettingsDangerZone() {
  const { user, member, signOut } = useAuth();
  const [confirmText, setConfirmText] = useState('');

  const deactivateMut = useMutation({
    mutationFn: async () => {
      if (!member) throw new Error('Kein Profil');
      const { error } = await supabase
        .from('members')
        .update({ is_active: false, exit_date: new Date().toISOString().split('T')[0] })
        .eq('id', member.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success('Konto deaktiviert');
      await signOut();
    },
    onError: () => toast.error('Fehler'),
  });

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
        {/* Deactivate own account */}
        <div className="rounded-lg border border-destructive/30 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <UserX className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium">Eigenes Konto deaktivieren</p>
              <p className="text-xs text-muted-foreground">
                Dein Mitgliedsprofil wird als inaktiv markiert. Du kannst dich danach nicht mehr anmelden.
              </p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <UserX className="mr-2 h-4 w-4" />
                Konto deaktivieren
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Konto wirklich deaktivieren?</AlertDialogTitle>
                <AlertDialogDescription>
                  Diese Aktion markiert dein Profil als inaktiv und setzt ein Austrittsdatum.
                  Um dies rückgängig zu machen, wende dich an einen Administrator.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deactivateMut.mutate()}
                >
                  Deaktivieren
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

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
