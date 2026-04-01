import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Bell, Mail, Calendar, UserCheck } from 'lucide-react';

const NOTIFICATION_OPTIONS = [
  { id: 'match_reminder', label: 'Spielerinnerungen', description: 'Erinnerung vor Spieltagen', icon: Calendar },
  { id: 'substitute_request', label: 'Ersatzanfragen', description: 'Benachrichtigung bei neuen Ersatzanfragen', icon: UserCheck },
  { id: 'training_booking', label: 'Trainingsanfragen', description: 'Neue Trainingsanfragen und Bestätigungen', icon: Bell },
  { id: 'news_updates', label: 'Vereins-News', description: 'Neue Beiträge und Ankündigungen', icon: Mail },
];

export default function SettingsNotifications() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Benachrichtigungen</CardTitle>
        <CardDescription>E-Mail- und Push-Benachrichtigungen konfigurieren</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {NOTIFICATION_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <div key={opt.id} className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label className="text-sm font-medium">{opt.label}</Label>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </div>
                </div>
                <Switch />
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground mt-4">
            Benachrichtigungspräferenzen werden lokal gespeichert. E-Mail-Benachrichtigungen werden in einer zukünftigen Version verfügbar sein.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
