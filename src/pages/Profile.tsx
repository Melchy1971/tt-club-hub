import SettingsProfile from '@/components/settings/SettingsProfile';
import { NAV_UI_LABELS_DE } from '@/constants/uiLabels';

export default function Profile() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Mein Profil</h1>
        <p className="page-description">Persönliche Daten, Rollen und Mannschaftszuordnungen</p>
      </div>
      <SettingsProfile />
    </div>
  );
}
