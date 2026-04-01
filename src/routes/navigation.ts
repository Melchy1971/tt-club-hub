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
  Users,
} from 'lucide-react';
import { MODULE_LABELS_DE } from '@/constants/uiLabels';
import type { RouteConfig } from '@/types/navigation';

export const ROUTES: RouteConfig[] = [
  { path: '/', label: MODULE_LABELS_DE.dashboard, module: 'dashboard', icon: LayoutDashboard, group: 'sport', exact: true, guard: { type: 'authenticated' } },
  { path: '/mitglieder', label: MODULE_LABELS_DE.members, module: 'members', icon: Users, group: 'sport', guard: { type: 'permission', permission: 'member:read' } },
  { path: '/mannschaften', label: MODULE_LABELS_DE.teams, module: 'teams', icon: Shield, group: 'sport', guard: { type: 'permission', permission: 'team:read' } },
  { path: '/spielbetrieb', label: MODULE_LABELS_DE.matches, module: 'matches', icon: CalendarDays, group: 'sport', guard: { type: 'permission', permission: 'match:read' } },
  { path: '/spielplan', label: MODULE_LABELS_DE.schedule, module: 'schedule', icon: CalendarDays, group: 'sport', guard: { type: 'permission', permission: 'match:read' } },
  { path: '/ersatzstellung', label: MODULE_LABELS_DE.substitutes, module: 'substitutes', icon: UserCheck, group: 'sport', guard: { type: 'permission', permission: 'substitute:read' } },
  { path: '/training', label: MODULE_LABELS_DE.training, module: 'training', icon: Dumbbell, group: 'sport', guard: { type: 'permission', permission: 'training:read' } },

  { path: '/kommunikation', label: MODULE_LABELS_DE.communication, module: 'communication', icon: MessageSquare, group: 'club', guard: { type: 'roles', roles: ['trainer', 'vorstand', 'admin', 'developer'] } },
  { path: '/vorstand', label: MODULE_LABELS_DE.board, module: 'board', icon: Landmark, group: 'club', guard: { type: 'roles', roles: ['vorstand', 'admin', 'developer'] } },

  { path: '/admin', label: MODULE_LABELS_DE.admin, module: 'admin', icon: ShieldAlert, group: 'system', guard: { type: 'roles', roles: ['admin', 'developer'] } },
  { path: '/rollen', label: MODULE_LABELS_DE.roles, module: 'roles', icon: Shield, group: 'system', guard: { type: 'roles', roles: ['admin', 'developer'] } },
  { path: '/saisons', label: MODULE_LABELS_DE.seasons, module: 'seasons', icon: Calendar, group: 'system', guard: { type: 'permission', permission: 'season:read' } },
  { path: '/einstellungen', label: MODULE_LABELS_DE.settings, module: 'settings', icon: Settings, group: 'system', guard: { type: 'permission', permission: 'settings:read' } },
  { path: '/import', label: MODULE_LABELS_DE.import, module: 'import', icon: Upload, group: 'system', guard: { type: 'roles', roles: ['admin', 'developer'] } },
  { path: '/info', label: MODULE_LABELS_DE.info, module: 'info', icon: Info, group: 'system', guard: { type: 'authenticated' } },

  { path: '/profil', label: MODULE_LABELS_DE.profile, module: 'profile', icon: UserCircle, group: 'system', hideInSidebar: true, guard: { type: 'authenticated' } },
  { path: '/auth', label: MODULE_LABELS_DE.auth, module: 'auth', group: 'system', hideInSidebar: true, guard: { type: 'public' } },
];
