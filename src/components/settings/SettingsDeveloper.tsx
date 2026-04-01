import { useQuery } from '@tanstack/react-query';
import { Code2, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { profileInfoKeys } from '@/lib/queryKeys';
import { infoService } from '@/services/infoService';

export default function SettingsDeveloper() {
  const { data: developerInfo } = useQuery({
    queryKey: profileInfoKeys.developerInfo(),
    queryFn: () => infoService.getDeveloperInfo(),
  });

  const { data: security } = useQuery({
    queryKey: profileInfoKeys.securityCheck(),
    queryFn: () => infoService.runSecurityCheck(),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Code2 className="h-5 w-5 text-primary" />Tool-Metadaten</CardTitle>
          <CardDescription>Version, Build-Datum und Support-Kontakt</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <InfoRow label="Version" value={developerInfo?.toolMetadata.version} />
          <InfoRow label="Build-Datum" value={developerInfo?.toolMetadata.buildDate} />
          <div className="sm:col-span-2 flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <a className="text-primary hover:underline" href={`mailto:${developerInfo?.toolMetadata.supportEmail ?? ''}`}>
              {developerInfo?.toolMetadata.supportEmail ?? '–'}
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />Lizenzmodell</CardTitle>
          <CardDescription>serial_key, status, activated_at, valid_until</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <InfoRow label="Serial Key" value={developerInfo?.license?.serialKey} />
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">
              <Badge variant="secondary">{developerInfo?.license?.status ?? '–'}</Badge>
            </dd>
          </div>
          <InfoRow label="Aktiviert am" value={developerInfo?.license?.activatedAt} />
          <InfoRow label="Gültig bis" value={developerInfo?.license?.validUntil} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Sicherheitsprüfung</CardTitle>
          <CardDescription>Prüft Trennung von öffentlichen und internen Daten.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Badge variant={security?.passed ? 'default' : 'destructive'}>
            {security?.passed ? 'Bestanden' : 'Fehlgeschlagen'}
          </Badge>
          <Separator />
          {(security?.checks ?? []).map((check) => (
            <div key={check.key} className="flex items-center justify-between gap-2">
              <span>{check.message}</span>
              <Badge variant={check.passed ? 'secondary' : 'destructive'}>
                {check.passed ? 'OK' : 'Fehler'}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || '–'}</dd>
    </div>
  );
}
