import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { infoService } from '@/services/infoService';
import { resolveInfoAccess } from '@/services/infoAccessPolicy';
import { profileInfoKeys } from '@/lib/queryKeys';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Building2, Code2, Mail, Globe, Cpu, Wrench, KeyRound } from 'lucide-react';

const TECH_STACK = [
  { name: 'React', version: '18' },
  { name: 'TypeScript', version: '5' },
  { name: 'Vite', version: '5' },
  { name: 'Tailwind CSS', version: '3' },
  { name: 'Lovable Cloud', version: '–' },
  { name: 'shadcn/ui', version: '–' },
];

export default function SettingsInfo() {
  const { role } = useAuth();
  const access = resolveInfoAccess(role);

  const { data: club } = useQuery({
    queryKey: profileInfoKeys.publicClubInfo(),
    queryFn: () => infoService.getPublicClubInfo(),
  });

  const { data: developerInfo } = useQuery({
    queryKey: profileInfoKeys.developerInfo(),
    queryFn: () => infoService.getDeveloperInfo(),
    enabled: access.canReadDeveloperArea,
  });

  const toolMetadata = developerInfo?.toolMetadata;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Vereinsinformationen (öffentlich)</CardTitle>
              <CardDescription>Getrenntes Lesemodell für öffentliche Club-Daten</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {club ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <InfoRow label="Vereinsname" value={club.clubName} />
              <InfoRow label="Vereinsnummer" value={club.clubNumber} />
              <InfoRow label="Verband" value={club.association} />
              <InfoRow label="Anschrift" value={[club.street, [club.zipCode, club.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')} />
              <InfoRow label="E-Mail" value={club.contactEmail} />
              <InfoRow label="Telefon" value={club.contactPhone} />
              {club.website && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Website</dt>
                  <dd className="font-medium">
                    <a href={club.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5" />
                      {club.website}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Keine Vereinsdaten hinterlegt.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>App-Informationen</CardTitle>
              <CardDescription>Version und technische Details</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <InfoRow label="Version" value={toolMetadata?.version ?? '–'} />
            <InfoRow label="Build-Datum" value={toolMetadata?.buildDate ?? '–'} />
          </dl>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              Tech-Stack
            </h4>
            <div className="flex flex-wrap gap-2">
              {TECH_STACK.map((tech) => (
                <Badge key={tech.name} variant="secondary" className="text-xs">
                  {tech.name}{tech.version !== '–' ? ` ${tech.version}` : ''}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Support:</span>
            {toolMetadata?.supportEmail ? (
              <a href={`mailto:${toolMetadata.supportEmail}`} className="text-primary hover:underline">
                {toolMetadata.supportEmail}
              </a>
            ) : (
              <span>–</span>
            )}
          </div>
        </CardContent>
      </Card>

      {access.canReadDeveloperArea && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Entwicklerbereich</CardTitle>
                <CardDescription>Interne Daten und Lizenzmodell (nur Rolle developer)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Interne Datenbasis</h4>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <InfoRow label="Club-Settings-ID" value={developerInfo?.internalClubInfo?.id} />
                <InfoRow label="Letzte Änderung" value={developerInfo?.internalClubInfo?.updatedAt} />
              </dl>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                Lizenz
              </h4>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <InfoRow label="Serial Key" value={developerInfo?.license?.serialKey} />
                <InfoRow label="Status" value={developerInfo?.license?.status} />
                <InfoRow label="Aktiviert am" value={developerInfo?.license?.activatedAt} />
                <InfoRow label="Gültig bis" value={developerInfo?.license?.validUntil} />
              </dl>
            </div>
          </CardContent>
        </Card>
      )}
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
