import SettingsInfo from '@/components/settings/SettingsInfo';

export default function InfoPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Info</h1>
        <p className="page-description">Vereins- und Systeminformationen</p>
      </div>
      <SettingsInfo />
    </div>
  );
}
