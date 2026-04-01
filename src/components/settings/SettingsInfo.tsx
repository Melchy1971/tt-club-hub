import { useQuery } from '@tanstack/react-query';
import { infoService } from '@/services/infoService';
import { profileInfoKeys } from '@/lib/queryKeys';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Globe } from 'lucide-react';

export default function SettingsInfo() {
  const { data: club } = useQuery({
    queryKey: profileInfoKeys.publicClubInfo(),
    queryFn: () => infoService.getPublicClubInfo(),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Vereinsinformationen</CardTitle>
              <CardDescription>Daten aus den Vereinseinstellungen</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {club ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <InfoRow label="Vereinsname" value={club.clubName} />
              <InfoRow label="Vereinsnummer" value={club.clubNumber} />
              <InfoRow label="Verband" value={club.association} />
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
