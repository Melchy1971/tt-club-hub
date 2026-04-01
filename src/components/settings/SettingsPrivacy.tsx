import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Shield, Eye, EyeOff, Clock, Trash2, FileText, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const CONSENT_TYPES = [
  { key: 'profile_visible', label: 'Profil für Teammitglieder sichtbar', description: 'Kontaktdaten für andere Mitglieder anzeigen', icon: Eye },
  { key: 'email_hidden', label: 'E-Mail-Adresse verbergen', description: 'E-Mail nur für Administratoren sichtbar', icon: EyeOff },
  { key: 'phone_hidden', label: 'Telefonnummer verbergen', description: 'Telefonnummer nur für Trainer und Administratoren sichtbar', icon: Shield },
];

interface ConsentRow {
  id: string;
  member_id: string;
  consent_type: string;
  granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
}

interface AuditRow {
  id: string;
  consent_type: string;
  action: string;
  performed_by: string;
  created_at: string;
}

interface DeletionRow {
  id: string;
  member_id: string;
  reason: string | null;
  status: string;
  created_at: string;
}

export default function SettingsPrivacy() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  // Get current member
  const { data: member } = useQuery({
    queryKey: ['my-member'],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Get consents for current member
  const { data: consents = [] } = useQuery({
    queryKey: ['member-consents', member?.id],
    queryFn: async () => {
      if (!member?.id) return [];
      const { data } = await (supabase
        .from('member_consents' as any)
        .select('*')
        .eq('member_id', member.id) as any);
      return (data ?? []) as ConsentRow[];
    },
    enabled: !!member?.id,
  });

  // Get audit log
  const { data: auditLog = [] } = useQuery({
    queryKey: ['consent-audit-log', member?.id],
    queryFn: async () => {
      if (!member?.id) return [];
      const { data } = await (supabase
        .from('consent_audit_log' as any)
        .select('*')
        .eq('member_id', member.id)
        .order('created_at', { ascending: false })
        .limit(20) as any);
      return (data ?? []) as AuditRow[];
    },
    enabled: !!member?.id,
  });

  // Get my deletion requests
  const { data: deletionRequests = [] } = useQuery({
    queryKey: ['my-deletion-requests', member?.id],
    queryFn: async () => {
      if (!member?.id) return [];
      const { data } = await (supabase
        .from('deletion_requests' as any)
        .select('*')
        .eq('member_id', member.id)
        .order('created_at', { ascending: false }) as any);
      return (data ?? []) as DeletionRow[];
    },
    enabled: !!member?.id,
  });

  // Toggle consent
  const toggleConsent = useMutation({
    mutationFn: async ({ consentType, granted }: { consentType: string; granted: boolean }) => {
      if (!member?.id || !user?.id) throw new Error('Nicht angemeldet');

      const existing = consents.find((c) => c.consent_type === consentType);

      if (existing) {
        const { error } = await (supabase
          .from('member_consents' as any)
          .update({
            granted,
            granted_at: granted ? new Date().toISOString() : existing.granted_at,
            revoked_at: !granted ? new Date().toISOString() : null,
          } as any)
          .eq('id', existing.id) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from('member_consents' as any)
          .insert({
            member_id: member.id,
            consent_type: consentType,
            granted,
            granted_at: granted ? new Date().toISOString() : null,
          } as any) as any);
        if (error) throw error;
      }

      // Audit log
      await (supabase
        .from('consent_audit_log' as any)
        .insert({
          member_id: member.id,
          consent_type: consentType,
          action: granted ? 'granted' : 'revoked',
          performed_by: user.id,
        } as any) as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-consents'] });
      queryClient.invalidateQueries({ queryKey: ['consent-audit-log'] });
      toast.success('Datenschutzeinstellung aktualisiert');
    },
    onError: () => toast.error('Fehler beim Speichern'),
  });

  // Create deletion request
  const createDeletionRequest = useMutation({
    mutationFn: async (reason: string) => {
      if (!member?.id || !user?.id) throw new Error('Nicht angemeldet');
      const { error } = await (supabase
        .from('deletion_requests' as any)
        .insert({
          member_id: member.id,
          reason: reason || null,
          requested_by: user.id,
        } as any) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-deletion-requests'] });
      setDeleteDialogOpen(false);
      setDeleteReason('');
      toast.success('Löschanfrage wurde erstellt');
    },
    onError: () => toast.error('Fehler beim Erstellen der Löschanfrage'),
  });

  const getConsentValue = (consentType: string) => {
    const consent = consents.find((c) => c.consent_type === consentType);
    return consent?.granted ?? false;
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd.MM.yyyy HH:mm', { locale: de });
    } catch {
      return dateStr;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="secondary">Ausstehend</Badge>;
      case 'approved': return <Badge className="bg-primary text-primary-foreground">Genehmigt</Badge>;
      case 'rejected': return <Badge variant="destructive">Abgelehnt</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingRequest = deletionRequests.find((r) => r.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Consent Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Datenschutz-Einwilligungen
          </CardTitle>
          <CardDescription>
            Steuere die Sichtbarkeit deiner persönlichen Daten. Jede Änderung wird mit Zeitstempel protokolliert.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {CONSENT_TYPES.map((ct) => {
            const Icon = ct.icon;
            const granted = getConsentValue(ct.key);
            const consent = consents.find((c) => c.consent_type === ct.key);
            return (
              <div key={ct.key} className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label className="text-sm font-medium">{ct.label}</Label>
                    <p className="text-xs text-muted-foreground">{ct.description}</p>
                    {consent && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {granted && consent.granted_at
                          ? `Erteilt am ${formatDate(consent.granted_at)}`
                          : consent.revoked_at
                            ? `Widerrufen am ${formatDate(consent.revoked_at)}`
                            : 'Nicht erteilt'}
                      </p>
                    )}
                  </div>
                </div>
                <Switch
                  checked={granted}
                  onCheckedChange={(checked) =>
                    toggleConsent.mutate({ consentType: ct.key, granted: checked })
                  }
                  disabled={toggleConsent.isPending}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Consent-Historie
          </CardTitle>
          <CardDescription>
            Protokoll aller Datenschutz-Änderungen für Auditierbarkeit
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditLog.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Noch keine Änderungen protokolliert
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zeitpunkt</TableHead>
                  <TableHead>Einstellung</TableHead>
                  <TableHead>Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLog.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">{formatDate(entry.created_at)}</TableCell>
                    <TableCell className="text-sm">
                      {CONSENT_TYPES.find((ct) => ct.key === entry.consent_type)?.label ?? entry.consent_type}
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.action === 'granted' ? 'default' : 'secondary'}>
                        {entry.action === 'granted' ? 'Erteilt' : 'Widerrufen'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Deletion Requests */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Löschanfrage
          </CardTitle>
          <CardDescription>
            Beantrage die vollständige Löschung deiner personenbezogenen Daten gemäß DSGVO Art. 17
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {deletionRequests.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Bisherige Anfragen</Label>
              {deletionRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm">{formatDate(req.created_at)}</p>
                    {req.reason && (
                      <p className="text-xs text-muted-foreground">{req.reason}</p>
                    )}
                  </div>
                  {statusBadge(req.status)}
                </div>
              ))}
            </div>
          )}

          {deletionRequests.length > 0 && <Separator />}

          {pendingRequest ? (
            <p className="text-sm text-muted-foreground">
              Du hast bereits eine ausstehende Löschanfrage. Ein Administrator wird diese bearbeiten.
            </p>
          ) : (
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Löschanfrage erstellen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Datenlöschung beantragen</DialogTitle>
                  <DialogDescription>
                    Diese Anfrage wird an einen Administrator weitergeleitet. Nach Genehmigung werden
                    alle deine personenbezogenen Daten unwiderruflich gelöscht.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label>Begründung (optional)</Label>
                  <Textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Warum möchtest du deine Daten löschen lassen?"
                    maxLength={500}
                  />
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => createDeletionRequest.mutate(deleteReason)}
                    disabled={createDeletionRequest.isPending}
                  >
                    {createDeletionRequest.isPending ? 'Wird erstellt…' : 'Anfrage absenden'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
