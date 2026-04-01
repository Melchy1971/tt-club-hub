import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Shield, Users, UserCircle, Building2, Calendar, MapPin,
  Palette, Bell, Lock, ShieldAlert, Database, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin, isStaff } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import type { AppRole } from '@/types/auth';

import SettingsRoles from '@/components/settings/SettingsRoles';
import SettingsPermissions from '@/components/settings/SettingsPermissions';
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

interface SettingsTab {
  id: string;
  label: string;
  icon: React.ElementType;
  minRoles?: AppRole[];
  component: React.ComponentType;
}

const TABS: SettingsTab[] = [
  { id: 'rollen', label: 'Rollen', icon: Users, minRoles: ['admin', 'developer'], component: SettingsRoles },
  { id: 'rechte', label: 'Rollen & Rechte', icon: Shield, minRoles: ['admin', 'developer'], component: SettingsPermissions },
  { id: 'profil', label: 'Mein Profil', icon: UserCircle, component: SettingsProfile },
  { id: 'verein', label: 'Vereinsdaten', icon: Building2, minRoles: ['admin', 'vorstand', 'developer'], component: SettingsClub },
  { id: 'saisons', label: 'Saisonverwaltung', icon: Calendar, minRoles: ['admin', 'vorstand', 'developer'], component: SettingsSeasons },
  { id: 'spiellokale', label: 'Spiellokale', icon: MapPin, minRoles: ['admin', 'vorstand', 'developer'], component: SettingsVenues },
  { id: 'darstellung', label: 'Darstellung', icon: Palette, component: SettingsAppearance },
  { id: 'benachrichtigungen', label: 'Benachrichtigungen', icon: Bell, component: SettingsNotifications },
  { id: 'datenschutz', label: 'Datenschutz', icon: Lock, component: SettingsPrivacy },
  { id: 'sicherheit', label: 'Sicherheit', icon: ShieldAlert, minRoles: ['admin', 'vorstand', 'developer'], component: SettingsSecurity },
  { id: 'backup', label: 'Backup', icon: Database, minRoles: ['admin', 'developer'], component: SettingsBackup },
  { id: 'gefahrenzone', label: 'Gefahrenzone', icon: AlertTriangle, minRoles: ['admin', 'developer'], component: SettingsDangerZone },
];

export default function SettingsPage() {
  const { role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const visibleTabs = useMemo(
    () => TABS.filter((t) => !t.minRoles || (role && t.minRoles.includes(role))),
    [role],
  );

  const activeTabId = searchParams.get('tab') ?? visibleTabs[0]?.id ?? 'profil';
  const activeTab = visibleTabs.find((t) => t.id === activeTabId) ?? visibleTabs[0];

  const setTab = (id: string) => setSearchParams({ tab: id });

  const ActiveComponent = activeTab?.component;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Einstellungen</h1>
        <p className="page-description">Vereins- und Systemeinstellungen verwalten</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <nav className="w-full lg:w-64 shrink-0">
          <div className="stat-card p-2 space-y-0.5">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const active = tab.id === activeTab?.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTab(tab.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {ActiveComponent && <ActiveComponent />}
        </div>
      </div>
    </div>
  );
}
