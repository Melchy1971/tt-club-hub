import {
  LayoutDashboard,
  Shield,
  CalendarDays,
  UserCheck,
  Dumbbell,
  MessageSquare,
  Landmark,
  Upload,
  ShieldAlert,
  Settings,
  Info,
  UserCircle,
  Calendar,
} from 'lucide-react';
  Shield,
  CalendarDays,
  UserCheck,
  Dumbbell,
  MessageSquare,
  Landmark,
  Upload,
  ShieldAlert,
  Settings,
  Info,
  UserCircle,
} from 'lucide-react';
import type { AppRole, Permission } from '@/types/auth';

export type NavGroup = 'sport' | 'club' | 'system';

export interface RouteConfig {
  path: string;
  name: string;
  module: string;
  icon?: React.ElementType;
  group: NavGroup;
  exact?: boolean;
  hideInSidebar?: boolean;
  requiredPermission?: Permission;
  minRoles?: AppRole[]; // shortcut when Permission nicht reicht
}

export const ROUTES: RouteConfig[] = [
  { path: '/', name: 'Dashboard', module: 'dashboard', icon: LayoutDashboard, group: 'sport', exact: true },
  { path: '/mannschaften', name: 'Mannschaften', module: 'teams', icon: Shield, group: 'sport', requiredPermission: 'team:read' },
  { path: '/spielbetrieb', name: 'Spielplan', module: 'matches', icon: CalendarDays, group: 'sport', requiredPermission: 'match:read' },
  { path: '/ersatzstellung', name: 'Ersatzstellung', module: 'substitutes', icon: UserCheck, group: 'sport', requiredPermission: 'substitute:read' },
  { path: '/training', name: 'Training', module: 'training', icon: Dumbbell, group: 'sport', requiredPermission: 'training:read' },

  { path: '/kommunikation', name: 'Kommunikation', module: 'communication', icon: MessageSquare, group: 'club', minRoles: ['trainer', 'vorstand', 'admin', 'developer'] },
  { path: '/vorstand', name: 'Vorstand', module: 'board', icon: Landmark, group: 'club', minRoles: ['vorstand', 'admin', 'developer'] },
  { path: '/import', name: 'Import', module: 'import', icon: Upload, group: 'club', minRoles: ['admin', 'developer'] },

  { path: '/admin', name: 'Admin', module: 'admin', icon: ShieldAlert, group: 'system', minRoles: ['admin', 'developer'] },
  { path: '/saisons', name: 'Saisons', module: 'seasons', icon: Calendar, group: 'system', requiredPermission: 'season:read' },
  { path: '/einstellungen', name: 'Einstellungen', module: 'settings', icon: Settings, group: 'system', requiredPermission: 'settings:read' },
  { path: '/info', name: 'Info', module: 'info', icon: Info, group: 'system' },

  { path: '/profil', name: 'Profil', module: 'profile', icon: UserCircle, group: 'system', hideInSidebar: true },
  { path: '/auth', name: 'Login', module: 'auth', group: 'system', hideInSidebar: true },
];
