import type { SettingsSubpageId } from './types';

export interface SettingsSectionLayoutDef {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'danger';
}

export const SETTINGS_SECTION_LAYOUTS: Partial<Record<SettingsSubpageId, SettingsSectionLayoutDef[]>> = {
  roles: [
    {
      id: 'assignments',
      title: 'Rollen',
      description: 'Benutzerrollen und deren Zuweisungen.',
    },
  ],
  permissions: [
    {
      id: 'matrix',
      title: 'Rollen & Rechte',
      description: 'Feingranulare Modulrechte pro Rolle.',
    },
  ],
  profile: [
    {
      id: 'personal',
      title: 'Persönliche Daten',
      description: 'Name, Kontakt und öffentliche Profilangaben.',
    },
  ],
  club: [
    {
      id: 'identity',
      title: 'Vereinsidentität',
      description: 'Name, Kurzname, Kontakt und organisatorische Daten.',
    },
  ],
  season: [
    {
      id: 'cycle',
      title: 'Saisonzyklus',
      description: 'Aktive Saison, Phasen und Übergänge.',
    },
  ],
  venues: [
    {
      id: 'locations',
      title: 'Spielorte',
      description: 'Pflege von Heimspiel- und Ausweichorten.',
    },
  ],
  appearance: [
    {
      id: 'theme',
      title: 'Design',
      description: 'Farbschema und visuelle Präferenzen pro Nutzer.',
    },
  ],
  notifications: [
    {
      id: 'channels',
      title: 'Kanäle',
      description: 'Steuert Versand- und Benachrichtigungskanäle.',
    },
  ],
  privacy: [
    {
      id: 'visibility',
      title: 'Sichtbarkeit',
      description: 'Datensichtbarkeit und Profilfreigaben.',
    },
  ],
  security: [
    {
      id: 'auth',
      title: 'Anmeldung & Schutz',
      description: 'Passwort, Sessions und Multi-Faktor-Einstellungen.',
    },
  ],
  backup: [
    {
      id: 'snapshots',
      title: 'Backup',
      description: 'Sicherung, Export und Wiederherstellung administrativer Daten.',
    },
  ],
  danger: [
    {
      id: 'destructive',
      title: 'Destruktive Aktionen',
      description: 'Löschen und irreversible Admin-Operationen.',
      variant: 'danger',
    },
  ],
};

export function getSectionLayoutsForPage(id: SettingsSubpageId): SettingsSectionLayoutDef[] {
  return SETTINGS_SECTION_LAYOUTS[id] ?? [];
}
