import {
  AlertTriangle,
  Building2,
  Palette,
  Lock,
  Calendar,
  MapPin,
  Users,
  Database,
  SlidersHorizontal,
} from 'lucide-react';
import SettingsRoles from '@/components/settings/SettingsRoles';
import SettingsPermissions from '@/components/settings/SettingsPermissions';
import SettingsClub from '@/components/settings/SettingsClub';
import SettingsSeasons from '@/components/settings/SettingsSeasons';
import SettingsVenues from '@/components/settings/SettingsVenues';
import SettingsAppearance from '@/components/settings/SettingsAppearance';
import SettingsPrivacy from '@/components/settings/SettingsPrivacy';
import SettingsBackup from '@/components/settings/SettingsBackup';
import SettingsDangerZone from '@/components/settings/SettingsDangerZone';
import { SETTINGS_SUBPAGE_LABELS_DE } from '@/constants/uiLabels';
import { getSettingsPermissionRule } from './permissions';
import type { SettingsSubpageDef } from './types';

export const SETTINGS_SUBPAGES: SettingsSubpageDef[] = [
  { id: 'appearance', label: SETTINGS_SUBPAGE_LABELS_DE.appearance, icon: Palette, component: SettingsAppearance, group: 'account' },

  {
    id: 'club',
    label: SETTINGS_SUBPAGE_LABELS_DE.club,
    icon: Building2,
    component: SettingsClub,
    group: 'club',
    readAccess: getSettingsPermissionRule('club').read,
    writeAccess: getSettingsPermissionRule('club').write,
  },
  {
    id: 'season',
    label: SETTINGS_SUBPAGE_LABELS_DE.season,
    icon: Calendar,
    component: SettingsSeasons,
    group: 'club',
    readAccess: getSettingsPermissionRule('season').read,
    writeAccess: getSettingsPermissionRule('season').write,
  },
  {
    id: 'venues',
    label: SETTINGS_SUBPAGE_LABELS_DE.venues,
    icon: MapPin,
    component: SettingsVenues,
    group: 'club',
    readAccess: getSettingsPermissionRule('venues').read,
    writeAccess: getSettingsPermissionRule('venues').write,
  },

  {
    id: 'roles',
    label: SETTINGS_SUBPAGE_LABELS_DE.roles,
    icon: Users,
    component: SettingsRoles,
    group: 'admin',
    readAccess: getSettingsPermissionRule('roles').read,
    writeAccess: getSettingsPermissionRule('roles').write,
  },
  {
    id: 'permissions',
    label: SETTINGS_SUBPAGE_LABELS_DE.permissions,
    icon: SlidersHorizontal,
    component: SettingsPermissions,
    group: 'admin',
    readAccess: getSettingsPermissionRule('permissions').read,
    writeAccess: getSettingsPermissionRule('permissions').write,
  },
  {
    id: 'backup',
    label: SETTINGS_SUBPAGE_LABELS_DE.backup,
    icon: Database,
    component: SettingsBackup,
    group: 'admin',
    readAccess: getSettingsPermissionRule('backup').read,
    writeAccess: getSettingsPermissionRule('backup').write,
  },
  {
    id: 'danger',
    label: SETTINGS_SUBPAGE_LABELS_DE.danger,
    icon: AlertTriangle,
    component: SettingsDangerZone,
    group: 'admin',
    readAccess: getSettingsPermissionRule('danger').read,
    writeAccess: getSettingsPermissionRule('danger').write,
  },
];
