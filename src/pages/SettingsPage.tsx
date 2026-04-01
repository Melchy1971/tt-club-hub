import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Shield, Users, UserCircle, Building2, Calendar, MapPin,
  Palette, Bell, Lock, ShieldAlert, Database, AlertTriangle, Info,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import type { Permission } from '@/types/auth';

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
import SettingsInfo from '@/components/settings/SettingsInfo';

interface SettingsTab {
  id:                  string;
  label:               string;
  icon:                React.ElementType;
  /**
   * Minimale Permission für Sichtbarkeit dieses Tabs.
   * Wird via hasPermission(role, requiredPermission) geprüft.
   * Kein Wert → für alle angemeldeten Nutzer sichtbar.
   *
   *   'admin:all'     → nur admin + developer
   *   'settings:read' → vorstand + admin + developer
   *   (kein Wert)     → alle angemeldeten Nutzer
   */
  requiredPermission?: Permission;
  component:           React.ComponentType;
}

const TABS: SettingsTab[] = [
  // ── Account ──────────────────────────────────────────────
  { id: 'profil',            label: 'Mein Profil',          icon: UserCircle,   component: SettingsProfile },
  { id: 'sicherheit',        label: 'Sicherheit',            icon: ShieldAlert,  component: SettingsSecurity },
  { id: 'benachrichtigungen',label: 'Benachrichtigungen',    icon: Bell,         component: SettingsNotifications },
  { id: 'datenschutz',       label: 'Datenschutz',           icon: Lock,         component: SettingsPrivacy },
  { id: 'darstellung',       label: 'Darstellung',           icon: Palette,      component: SettingsAppearance },
  // ── Vereinsdaten (vorstand+) ──────────────────────────────
  { id: 'verein',      label: 'Vereinsdaten',    icon: Building2, requiredPermission: 'settings:read', component: SettingsClub },
  { id: 'saisons',     label: 'Saisonverwaltung',icon: Calendar,  requiredPermission: 'settings:read', component: SettingsSeasons },
  { id: 'spiellokale', label: 'Spiellokale',     icon: MapPin,    requiredPermission: 'settings:read', component: SettingsVenues },
  // ── System (admin+) ───────────────────────────────────────
  { id: 'rollen',      label: 'Rollen',          icon: Users,     requiredPermission: 'admin:all', component: SettingsRoles },
  { id: 'rechte',      label: 'Rollen & Rechte', icon: Shield,    requiredPermission: 'admin:all', component: SettingsPermissions },
  { id: 'backup',      label: 'Backup',          icon: Database,  requiredPermission: 'admin:all', component: SettingsBackup },
  { id: 'gefahrenzone',label: 'Gefahrenzone',    icon: AlertTriangle, requiredPermission: 'admin:all', component: SettingsDangerZone },
];

export default function SettingsPage() {
  const { role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const visibleTabs = useMemo(
    () => TABS.filter((t) => !t.requiredPermission || hasPermission(role, t.requiredPermission)),
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
                  type="button"
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
