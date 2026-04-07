import SettingsPrivacy from '@/components/settings/SettingsPrivacy';

export default function PrivacyPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Datenschutz</h1>
        <p className="page-description">Datenschutz-Einwilligungen und Löschanfragen verwalten</p>
      </div>
      <SettingsPrivacy />
    </div>
  );
}
