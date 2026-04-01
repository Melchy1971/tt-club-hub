import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Shield, Eye, EyeOff } from 'lucide-react';

export default function SettingsPrivacy() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Datenschutz</CardTitle>
        <CardDescription>Sichtbarkeit und Datenschutzeinstellungen</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <Eye className="h-5 w-5 text-muted-foreground" />
            <div>
              <Label className="text-sm font-medium">Profil für Teammitglieder sichtbar</Label>
              <p className="text-xs text-muted-foreground">Kontaktdaten für andere Mitglieder anzeigen</p>
            </div>
          </div>
          <Switch defaultChecked />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <EyeOff className="h-5 w-5 text-muted-foreground" />
            <div>
              <Label className="text-sm font-medium">E-Mail-Adresse verbergen</Label>
              <p className="text-xs text-muted-foreground">E-Mail nur für Administratoren sichtbar</p>
            </div>
          </div>
          <Switch />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <div>
              <Label className="text-sm font-medium">Telefonnummer verbergen</Label>
              <p className="text-xs text-muted-foreground">Telefonnummer nur für Trainer und Administratoren sichtbar</p>
            </div>
          </div>
          <Switch />
        </div>
        <p className="text-xs text-muted-foreground">
          Datenschutzpräferenzen werden in einer zukünftigen Version persistent gespeichert.
        </p>
      </CardContent>
    </Card>
  );
}
