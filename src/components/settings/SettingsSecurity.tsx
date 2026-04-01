import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Key, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsSecurity() {
  const { user, session } = useAuth();

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error('Fehler beim Senden');
    } else {
      toast.success('Passwort-Reset E-Mail gesendet');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sicherheit</CardTitle>
          <CardDescription>Passwort und Sitzungsinformationen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Key className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Passwort ändern</p>
                <p className="text-xs text-muted-foreground">Passwort-Reset per E-Mail anfordern</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handlePasswordReset}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset anfordern
            </Button>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium">Aktive Sitzung</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">E-Mail:</span>
              <span>{user?.email ?? '–'}</span>
              <span className="text-muted-foreground">Sitzung gültig bis:</span>
              <span>
                {session?.expires_at
                  ? new Date(session.expires_at * 1000).toLocaleString('de-DE')
                  : '–'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
