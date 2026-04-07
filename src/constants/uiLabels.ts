import type { AppRole, Permission } from '@/types/auth';
import type { SettingsSubpageId } from '@/settings/types';
import type { AppModuleKey, NavGroup } from '@/types/navigation';

const UNKNOWN_SUFFIX = 'Unbekannt';

export const MODULE_LABELS_DE: Record<AppModuleKey, string> = {
  dashboard: 'Übersicht',
  members: 'Mitglieder',
  teams: 'Mannschaften',
  matches: 'Spielbetrieb',
  schedule: 'Spielplan',
  substitutes: 'Ersatzstellung',
  training: 'Training',
  communication: 'Kommunikation',
  board: 'Vorstand',
  admin: 'Administration',
  roles: 'Rollen & Rechte',
  seasons: 'Saisons',
  settings: 'Einstellungen',
  import: 'Import',
  info: 'Info',
  profile: 'Profil',
  auth: 'Anmeldung',
};

export const SETTINGS_SUBPAGE_LABELS_DE: Record<SettingsSubpageId, string> = {
  roles: 'Rollen',
  permissions: 'Rollen & Rechte',
  profile: 'Mein Profil',
  security: 'Sicherheit',
  notifications: 'Benachrichtigungen',
  privacy: 'Datenschutz',
  appearance: 'Darstellung',
  club: 'Vereinsdaten',
  season: 'Saisonverwaltung',
  venues: 'Spiellokale',
  backup: 'Backup',
  danger: 'Gefahrenzone',
};

export const ROLE_LABELS_DE: Record<AppRole, string> = {
  developer: 'Entwickler',
  admin: 'Administrator',
  vorstand: 'Vorstand',
  trainer: 'Trainer',
  spieler: 'Spieler',
  mitglied: 'Mitglied',
};

export const PERMISSION_LABELS_DE: Record<Permission, string> = {
  'member:read': 'Mitglieder lesen',
  'member:write': 'Mitglieder bearbeiten',
  'member:delete': 'Mitglieder löschen',
  'team:read': 'Mannschaften lesen',
  'team:write': 'Mannschaften bearbeiten',
  'team:delete': 'Mannschaften löschen',
  'match:read': 'Spiele lesen',
  'match:write': 'Spiele bearbeiten',
  'match:delete': 'Spiele löschen',
  'season:read': 'Saisons lesen',
  'season:write': 'Saisons bearbeiten',
  'season:delete': 'Saisons löschen',
  'training:read': 'Training lesen',
  'training:write': 'Training bearbeiten',
  'substitute:read': 'Ersatzstellung lesen',
  'substitute:write': 'Ersatzstellung bearbeiten',
  'substitute:approve': 'Ersatzstellung freigeben',
  'settings:read': 'Einstellungen lesen',
  'settings:write': 'Einstellungen bearbeiten',
  'board:read': 'Vorstand lesen',
  'board:write': 'Vorstand bearbeiten',
  'board:delete': 'Vorstand löschen',
  'admin:all': 'Administration (Vollzugriff)',
};

export const STATUS_LABELS_DE = {
  pending: 'Ausstehend',
  confirmed: 'Bestätigt',
  cancelled: 'Abgesagt',
  available: 'Verfügbar',
  unavailable: 'Nicht verfügbar',
  maybe: 'Unsicher',
  unknown: 'Unbekannt',
  geplant: 'Geplant',
  laufend: 'Laufend',
  beendet: 'Beendet',
  verschoben: 'Verschoben',
  abgesagt: 'Abgesagt',
} as const;

export const NAV_GROUP_LABELS_DE: Record<NavGroup, string> = {
  sport: 'Sportbetrieb',
  club: 'Vereinsführung',
  system: 'System',
};

export const getModuleLabel = (module: string): string => MODULE_LABELS_DE[module as AppModuleKey] ?? `${UNKNOWN_SUFFIX}es Modul (${module})`;
export const getSettingsSubpageLabel = (id: string): string => SETTINGS_SUBPAGE_LABELS_DE[id as SettingsSubpageId] ?? `${UNKNOWN_SUFFIX}e Settings-Seite (${id})`;
export const getRoleLabel = (role: string): string => ROLE_LABELS_DE[role as AppRole] ?? `${UNKNOWN_SUFFIX}e Rolle (${role})`;
export const getPermissionLabel = (permission: string): string => PERMISSION_LABELS_DE[permission as Permission] ?? `${UNKNOWN_SUFFIX}e Berechtigung (${permission})`;
export const getStatusLabel = (status: string): string => STATUS_LABELS_DE[status as keyof typeof STATUS_LABELS_DE] ?? `${UNKNOWN_SUFFIX}er Status (${status})`;

export const NAV_UI_LABELS_DE = {
  appName: 'TT-Manager Pro',
  appTagline: 'Tischtennisverwaltung',
  userFallback: 'Benutzer',
  logout: 'Abmelden',
  settingsTitle: 'Einstellungen',
  settingsDescription: 'Vereins- und Systemeinstellungen verwalten',
};
