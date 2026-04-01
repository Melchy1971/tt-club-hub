import {
  Bell,
  AlertTriangle,
  Building2,
  Palette,
  Lock,
  UserCircle,
  ShieldAlert,
  Calendar,
  MapPin,
  Users,
  Database,
  SlidersHorizontal,
} from 'lucide-react';
import SettingsRoles from '@/components/settings/SettingsRoles';
import SettingsProfile from '@/components/settings/SettingsProfile';
import SettingsClub from '@/components/settings/SettingsClub';
import SettingsSeasons from '@/components/settings/SettingsSeasons';
import SettingsVenues from '@/components/settings/SettingsVenues';
import SettingsAppearance from '@/components/settings/SettingsAppearance';
import SettingsNotifications from '@/components/settings/SettingsNotifications';
import SettingsPrivacy from '@/components/settings/SettingsPrivacy';
import SettingsSecurity from '@/components/settings/SettingsSecurity';
import SettingsBackup from '@/components/settings/SettingsBackup';
import SettingsDangerZone from '@/components/settings/SettingsDangerZone';
import SettingsInfo from '@/components/settings/SettingsInfo';
import { SETTINGS_SUBPAGE_LABELS_DE } from '@/constants/uiLabels';
import { getSettingsPermissionRule } from './permissions';
import type { SettingsSubpageDef } from './types';

export const SETTINGS_SUBPAGES: SettingsSubpageDef[] = [
  { id: 'general', label: SETTINGS_SUBPAGE_LABELS_DE.general, icon: SlidersHorizontal, component: SettingsInfo, group: 'account' },
  { id: 'profile', label: SETTINGS_SUBPAGE_LABELS_DE.profile, icon: UserCircle, component: SettingsProfile, group: 'account' },
  { id: 'security', label: SETTINGS_SUBPAGE_LABELS_DE.security, icon: ShieldAlert, component: SettingsSecurity, group: 'account' },
  { id: 'notifications', label: SETTINGS_SUBPAGE_LABELS_DE.notifications, icon: Bell, component: SettingsNotifications, group: 'account' },
  { id: 'privacy', label: SETTINGS_SUBPAGE_LABELS_DE.privacy, icon: Lock, component: SettingsPrivacy, group: 'account' },
  { id: 'appearance', label: SETTINGS_SUBPAGE_LABELS_DE.appearance, icon: Palette, component: SettingsAppearance, group: 'account' },

  {
    id: 'club',
    label: SETTINGS_SUBPAGE_LABELS_DE.club,
    icon: Building2,
    component: SettingsClub,
    group: 'club',
    requiredPermission: getSettingsPermissionRule('club').read,
    writePermission: getSettingsPermissionRule('club').write,
  },
  {
    id: 'season',
    label: SETTINGS_SUBPAGE_LABELS_DE.season,
    icon: Calendar,
    component: SettingsSeasons,
    group: 'club',
    requiredPermission: getSettingsPermissionRule('season').read,
    writePermission: getSettingsPermissionRule('season').write,
  },
  {
    id: 'venues',
    label: SETTINGS_SUBPAGE_LABELS_DE.venues,
    icon: MapPin,
    component: SettingsVenues,
    group: 'club',
    requiredPermission: getSettingsPermissionRule('venues').read,
    writePermission: getSettingsPermissionRule('venues').write,
  },

  {
    id: 'roles',
    label: SETTINGS_SUBPAGE_LABELS_DE.roles,
    icon: Users,
    component: SettingsRoles,
    group: 'admin',
    requiredPermission: getSettingsPermissionRule('roles').read,
    writePermission: getSettingsPermissionRule('roles').write,
  },
  {
    id: 'backup',
    label: SETTINGS_SUBPAGE_LABELS_DE.backup,
    icon: Database,
    component: SettingsBackup,
    group: 'admin',
    requiredPermission: getSettingsPermissionRule('backup').read,
    writePermission: getSettingsPermissionRule('backup').write,
  },
  {
    id: 'danger',
    label: SETTINGS_SUBPAGE_LABELS_DE.danger,
    icon: AlertTriangle,
    component: SettingsDangerZone,
    group: 'admin',
    requiredPermission: getSettingsPermissionRule('danger').read,
    writePermission: getSettingsPermissionRule('danger').write,
  },
];
