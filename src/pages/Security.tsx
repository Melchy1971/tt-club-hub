import SettingsSecurity from '@/components/settings/SettingsSecurity';

export default function SecurityPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Sicherheit</h1>
        <p className="page-description">Passwort und Sitzungsinformationen verwalten</p>
      </div>
      <SettingsSecurity />
    </div>
  );
}
