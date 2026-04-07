import SettingsNotifications from '@/components/settings/SettingsNotifications';

export default function NotificationsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Benachrichtigungen</h1>
        <p className="page-description">E-Mail- und Push-Benachrichtigungen konfigurieren</p>
      </div>
      <SettingsNotifications />
    </div>
  );
}
