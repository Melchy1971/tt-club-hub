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
  UserCircle,
  Info,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { hasPermission, isAdmin, isStaff } from '@/lib/permissions';
import type { AppRole, Permission } from '@/types/auth';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  requiredPermission?: Permission;
  requiredRole?: (role: AppRole | null | undefined) => boolean;
}

const sportNav: NavItem[] = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Mannschaften', url: '/mannschaften', icon: Shield, requiredPermission: 'team:read' },
  { title: 'Spielplan', url: '/spielbetrieb', icon: CalendarDays, requiredPermission: 'match:read' },
  { title: 'Ersatzstellung', url: '/ersatzstellung', icon: UserCheck, requiredPermission: 'substitute:read' },
  { title: 'Training', url: '/training', icon: Dumbbell, requiredPermission: 'training:read' },
];

const clubNav: NavItem[] = [
  { title: 'Kommunikation', url: '/kommunikation', icon: MessageSquare, requiredRole: isStaff },
  { title: 'Vorstand', url: '/vorstand', icon: Landmark, requiredRole: isStaff },
  { title: 'Import', url: '/import', icon: Upload, requiredRole: isAdmin },
];

const systemNav: NavItem[] = [
  { title: 'Admin', url: '/admin', icon: ShieldAlert, requiredRole: isAdmin },
  { title: 'Einstellungen', url: '/einstellungen', icon: Settings, requiredPermission: 'settings:read' },
  { title: 'Info', url: '/info', icon: Info },
];

function filterNav(items: NavItem[], role: AppRole | null | undefined): NavItem[] {
  return items.filter((item) => {
    if (item.requiredRole) return item.requiredRole(role);
    if (item.requiredPermission) return hasPermission(role, item.requiredPermission);
    return true;
  });
}

export function AppSidebar() {
  const { signOut, user, role } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const filteredSport = filterNav(sportNav, role);
  const filteredClub = filterNav(clubNav, role);
  const filteredSystem = filterNav(systemNav, role);

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const renderGroup = (label: string, items: NavItem[]) => {
    if (items.length === 0) return null;
    return (
      <SidebarGroup key={label}>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={isActive(item.url)}>
                  <NavLink
                    to={item.url}
                    end={item.url === '/'}
                    className="hover:bg-sidebar-accent/50"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  >
                    <item.icon className="mr-2 h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-display font-bold text-sm">
            TT
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display font-bold text-sidebar-accent-foreground text-base tracking-tight leading-tight">
                TT-Manager Pro
              </span>
              <span className="text-[10px] text-sidebar-foreground/50 leading-tight">
                Tischtennisverwaltung
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {renderGroup('Sportbetrieb', filteredSport)}
        {renderGroup('Vereinsführung', filteredClub)}
        {renderGroup('System', filteredSystem)}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <NavLink
          to="/profil"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
        >
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-sidebar-accent-foreground truncate">
                {user?.name ?? 'Benutzer'}
              </span>
              <span className="text-[11px] text-sidebar-foreground/50 truncate">
                {user?.email ?? ''}
              </span>
            </div>
          )}
        </NavLink>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Abmelden</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
