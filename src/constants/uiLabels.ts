import type { Enums } from '@/integrations/supabase/types';
import type { AppRole, Permission } from '@/types/auth';
import type { AgeGroup, PhaseType, SeasonAudience } from '@/types/domain/season';
import type { SettingsSubpageId } from '@/settings/types';
import type { SettingsSubpageGroup } from '@/settings/types';
import type { AppModuleKey, NavGroup } from '@/types/navigation';
import type { ModuleKey, PermissionLevel } from '@/constants/permissionsMatrix';

const UNKNOWN_SUFFIX = 'Unbekannt';

export type MatchStatus = Enums<'match_status'>;
export type SubstituteStatus = Enums<'substitute_status'>;
export type TrainingBookingStatus = Enums<'training_booking_status'>;
export type SettingsTabKey = SettingsSubpageId;

type LabelMap<TKey extends string | number> = Readonly<Record<TKey, string>>;

const resolveLabel = <TKey extends string | number>(
  map: LabelMap<TKey>,
  key: string | number,
  fallback: (unknownKey: string | number) => string,
): string => {
  if (key in map) {
    return map[key as TKey];
  }

  return fallback(key);
};

export const MODULE_LABELS_DE: Record<AppModuleKey, string> = {
  dashboard: 'Übersicht',
  members: 'Mitglieder',
  teams: 'Mannschaften',
  matches: 'Spielbetrieb',
  schedule: 'Spielplan',
  substitutes: 'Ersatzstellung',
  training: 'Training',
  standings: 'Tabelle',
  communication: 'Kommunikation',
  board: 'Vorstand',
  admin: 'Administration',
  roles: 'Rollen & Rechte',
  seasons: 'Saisons',
  settings: 'Einstellungen',
  import: 'Import',
  info: 'Info',
  profile: 'Profil',
  security: 'Sicherheit',
  notifications: 'Benachrichtigungen',
  privacy: 'Datenschutz',
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
  agent_integrations: 'Agent-Integrationen',
  danger: 'Gefahrenzone',
};

export const SETTINGS_TAB_LABELS_DE: Record<SettingsTabKey, string> = SETTINGS_SUBPAGE_LABELS_DE;

export const SETTINGS_GROUP_LABELS_DE: Record<SettingsSubpageGroup, string> = {
  account: 'Konto',
  club: 'Verein',
  admin: 'Administration',
};

export const ROLE_LABELS_DE: Record<string, string> = {
  developer: 'Entwickler',
  admin: 'Administrator',
  vorstand: 'Vorstand',
  trainer: 'Trainer',
  spieler: 'Spieler',
  mitglied: 'Mitglied',
  fördermitglied: 'Fördermitglied',
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

export const PERMISSION_LEVEL_LABELS_DE: Record<PermissionLevel, string> = {
  NONE: 'Kein Zugriff',
  READ: 'Lesen',
  WRITE: 'Bearbeiten',
};

export const PERMISSION_MODULE_LABELS_DE: Record<ModuleKey, string> = {
  dashboard: MODULE_LABELS_DE.dashboard,
  teams: MODULE_LABELS_DE.teams,
  schedule: MODULE_LABELS_DE.schedule,
  members: MODULE_LABELS_DE.members,
  communication: MODULE_LABELS_DE.communication,
  board: MODULE_LABELS_DE.board,
  settings: MODULE_LABELS_DE.settings,
  import: MODULE_LABELS_DE.import,
  substitutes: MODULE_LABELS_DE.substitutes,
  training: MODULE_LABELS_DE.training,
  standings: MODULE_LABELS_DE.standings,
  security: MODULE_LABELS_DE.security,
  notifications: MODULE_LABELS_DE.notifications,
  privacy: MODULE_LABELS_DE.privacy,
  info: MODULE_LABELS_DE.info,
  seasons: MODULE_LABELS_DE.seasons,
};

export const MATCH_STATUS_LABELS_DE: Record<MatchStatus, string> = {
  geplant: 'Geplant',
  laufend: 'Laufend',
  beendet: 'Beendet',
  verschoben: 'Verschoben',
  abgesagt: 'Abgesagt',
};

export const SUBSTITUTE_STATUS_LABELS_DE: Record<SubstituteStatus, string> = {
  pending: 'Ausstehend',
  accepted: 'Angenommen',
  rejected: 'Abgelehnt',
};

export const TRAINING_BOOKING_STATUS_LABELS_DE: Record<TrainingBookingStatus, string> = {
  pending: 'Ausstehend',
  confirmed: 'Bestätigt',
  cancelled: 'Abgesagt',
};

export const STATUS_LABELS_DE = {
  ...MATCH_STATUS_LABELS_DE,
  ...SUBSTITUTE_STATUS_LABELS_DE,
  ...TRAINING_BOOKING_STATUS_LABELS_DE,
  available: 'Verfügbar',
  unavailable: 'Nicht verfügbar',
  maybe: 'Unsicher',
  unknown: 'Unbekannt',
} as const;

export const SEASON_AUDIENCE_LABELS_DE: Record<SeasonAudience, string> = {
  erwachsene: 'Erwachsene',
  jugend: 'Jugend',
};

export const AGE_GROUP_LABELS_DE: Record<AgeGroup, string> = {
  herren: 'Herren',
  damen: 'Damen',
  senioren: 'Senioren',
  seniorinnen: 'Seniorinnen',
  jungen_18: 'Jungen U18',
  maedchen_18: 'Mädchen U18',
  jungen_15: 'Jungen U15',
  maedchen_15: 'Mädchen U15',
  jungen_13: 'Jungen U13',
  maedchen_13: 'Mädchen U13',
  jungen_11: 'Jungen U11',
  maedchen_11: 'Mädchen U11',
};

export const PHASE_TYPE_LABELS_DE: Record<PhaseType, string> = {
  first_half: 'Vorrunde',
  second_half: 'Rückrunde',
  single_half: 'Halbrunde',
};

export const GENDER_LABELS_DE = {
  maennlich: 'Männlich',
  weiblich: 'Weiblich',
  divers: 'Divers',
} as const;

export type GenderLabelKey = keyof typeof GENDER_LABELS_DE;

export const NAV_GROUP_LABELS_DE: Record<NavGroup, string> = {
  personal: 'Mein Bereich',
  sport: 'Sportbetrieb',
  club: 'Vereinsführung',
  system: 'System',
};

export const getModuleLabel = (module: AppModuleKey | string): string =>
  resolveLabel(MODULE_LABELS_DE, module, (unknownKey) => `${UNKNOWN_SUFFIX}es Modul (${unknownKey})`);

export const getPermissionModuleLabel = (module: ModuleKey | string): string =>
  resolveLabel(PERMISSION_MODULE_LABELS_DE, module, (unknownKey) => `${UNKNOWN_SUFFIX}es Modul (${unknownKey})`);

export const getSettingsSubpageLabel = (id: SettingsSubpageId | string): string =>
  resolveLabel(SETTINGS_SUBPAGE_LABELS_DE, id, (unknownKey) => `${UNKNOWN_SUFFIX}e Settings-Seite (${unknownKey})`);

export const getSettingsTabLabel = (id: SettingsTabKey | string): string =>
  resolveLabel(SETTINGS_TAB_LABELS_DE, id, (unknownKey) => `${UNKNOWN_SUFFIX}er Tab (${unknownKey})`);

export const getSettingsGroupLabel = (group: SettingsSubpageGroup | string): string =>
  resolveLabel(SETTINGS_GROUP_LABELS_DE, group, (unknownKey) => `${UNKNOWN_SUFFIX}e Settings-Gruppe (${unknownKey})`);

export const getRoleLabel = (role: AppRole | string): string =>
  resolveLabel(ROLE_LABELS_DE, role, (unknownKey) => `${UNKNOWN_SUFFIX}e Rolle (${unknownKey})`);

export const getPermissionLabel = (permission: Permission | string): string =>
  resolveLabel(PERMISSION_LABELS_DE, permission, (unknownKey) => `${UNKNOWN_SUFFIX}e Berechtigung (${unknownKey})`);

export const getPermissionLevelLabel = (level: PermissionLevel | string): string =>
  resolveLabel(PERMISSION_LEVEL_LABELS_DE, level, (unknownKey) => `${UNKNOWN_SUFFIX}e Berechtigungsstufe (${unknownKey})`);

export const getMatchStatusLabel = (status: MatchStatus | string): string =>
  resolveLabel(MATCH_STATUS_LABELS_DE, status, (unknownKey) => `${UNKNOWN_SUFFIX}er Spielstatus (${unknownKey})`);

export const getSubstituteStatusLabel = (status: SubstituteStatus | string): string =>
  resolveLabel(SUBSTITUTE_STATUS_LABELS_DE, status, (unknownKey) => `${UNKNOWN_SUFFIX}er Ersatzstatus (${unknownKey})`);

export const getTrainingBookingStatusLabel = (status: TrainingBookingStatus | string): string =>
  resolveLabel(TRAINING_BOOKING_STATUS_LABELS_DE, status, (unknownKey) => `${UNKNOWN_SUFFIX}er Trainingsstatus (${unknownKey})`);

export const getStatusLabel = (status: keyof typeof STATUS_LABELS_DE | string): string =>
  resolveLabel(STATUS_LABELS_DE, status, (unknownKey) => `${UNKNOWN_SUFFIX}er Status (${unknownKey})`);

export const getSeasonAudienceLabel = (audience: SeasonAudience | string): string =>
  resolveLabel(SEASON_AUDIENCE_LABELS_DE, audience, (unknownKey) => `${UNKNOWN_SUFFIX}e Zielgruppe (${unknownKey})`);

export const getAgeGroupLabel = (ageGroup: AgeGroup | string): string =>
  resolveLabel(AGE_GROUP_LABELS_DE, ageGroup, (unknownKey) => `${UNKNOWN_SUFFIX}e Altersgruppe (${unknownKey})`);

export const getPhaseTypeLabel = (phaseType: PhaseType | string): string =>
  resolveLabel(PHASE_TYPE_LABELS_DE, phaseType, (unknownKey) => `${UNKNOWN_SUFFIX}e Saisonphase (${unknownKey})`);

export const getGenderLabel = (gender: GenderLabelKey | string): string =>
  resolveLabel(GENDER_LABELS_DE, gender, (unknownKey) => `${UNKNOWN_SUFFIX}es Geschlecht (${unknownKey})`);

export const getNavGroupLabel = (group: NavGroup | string): string =>
  resolveLabel(NAV_GROUP_LABELS_DE, group, (unknownKey) => `${UNKNOWN_SUFFIX}e Navigationsgruppe (${unknownKey})`);

export const NAV_UI_LABELS_DE = {
  appName: 'TT-Manager Pro',
  appTagline: 'Tischtennisverwaltung',
  userFallback: 'Benutzer',
  logout: 'Abmelden',
  settingsTitle: 'Einstellungen',
  settingsDescription: 'Vereins- und Systemeinstellungen verwalten',
};
