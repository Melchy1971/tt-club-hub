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
import type { SettingsSubpageDef } from './types';

export const SETTINGS_SUBPAGES: SettingsSubpageDef[] = [
  { id: 'general', label: 'Allgemein', icon: SlidersHorizontal, component: SettingsInfo, group: 'account' },
  { id: 'profile', label: 'Mein Profil', icon: UserCircle, component: SettingsProfile, group: 'account' },
  { id: 'security', label: 'Sicherheit', icon: ShieldAlert, component: SettingsSecurity, group: 'account' },
  { id: 'notifications', label: 'Benachrichtigungen', icon: Bell, component: SettingsNotifications, group: 'account' },
  { id: 'privacy', label: 'Datenschutz', icon: Lock, component: SettingsPrivacy, group: 'account' },
  { id: 'appearance', label: 'Darstellung', icon: Palette, component: SettingsAppearance, group: 'account' },

  {
    id: 'club',
    label: 'Vereinsdaten',
    icon: Building2,
    component: SettingsClub,
    group: 'club',
    requiredPermission: 'settings:read',
    writePermission: 'settings:write',
  },
  {
    id: 'season',
    label: 'Saisonverwaltung',
    icon: Calendar,
    component: SettingsSeasons,
    group: 'club',
    requiredPermission: 'settings:read',
    writePermission: 'settings:write',
  },
  {
    id: 'venues',
    label: 'Spiellokale',
    icon: MapPin,
    component: SettingsVenues,
    group: 'club',
    requiredPermission: 'settings:read',
    writePermission: 'settings:write',
  },

  {
    id: 'roles',
    label: 'Rollen',
    icon: Users,
    component: SettingsRoles,
    group: 'admin',
    requiredPermission: 'admin:all',
    writePermission: 'admin:all',
  },
  {
    id: 'backup',
    label: 'Backup',
    icon: Database,
    component: SettingsBackup,
    group: 'admin',
    requiredPermission: 'admin:all',
    writePermission: 'admin:all',
  },
  {
    id: 'danger',
    label: 'Gefahrenzone',
    icon: AlertTriangle,
    component: SettingsDangerZone,
    group: 'admin',
    requiredPermission: 'admin:all',
    writePermission: 'admin:all',
  },
];
