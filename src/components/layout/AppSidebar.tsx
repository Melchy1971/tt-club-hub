import { LogOut } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { useNavigationPermissions } from '@/hooks/useNavigationPermissions';
import { NAV_GROUP_LABELS_DE, NAV_UI_LABELS_DE } from '@/constants/uiLabels';
import type { RouteConfig } from '@/types/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { navGroups } = useNavigationPermissions();

  const { data: clubSettings } = useQuery({
    queryKey: ['club-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('club_settings').select('club_name, logo_url').limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const renderGroup = (label: string, items: RouteConfig[]) => {
    if (items.length === 0) return null;
    return (
      <SidebarGroup key={label}>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton asChild isActive={isActive(item.path)}>
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    className="hover:bg-sidebar-accent/50"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  >
                    {item.icon && <item.icon className="mr-2 h-4 w-4 shrink-0" />}
                    {!collapsed && <span>{item.label}</span>}
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
          {clubSettings?.logo_url ? (
            <img
              src={clubSettings.logo_url}
              alt="Vereinslogo"
              className="h-9 w-9 shrink-0 rounded-lg object-contain"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-display font-bold text-sm">
              TT
            </div>
          )}
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display font-bold text-sidebar-accent-foreground text-base tracking-tight leading-tight">
                {clubSettings?.club_name || NAV_UI_LABELS_DE.appName}
              </span>
              <span className="text-[10px] text-sidebar-foreground/50 leading-tight">
                {NAV_UI_LABELS_DE.appTagline}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {renderGroup(NAV_GROUP_LABELS_DE.sport, navGroups.sport)}
        {renderGroup(NAV_GROUP_LABELS_DE.club, navGroups.club)}
        {renderGroup(NAV_GROUP_LABELS_DE.system, navGroups.system)}
        {renderGroup(NAV_GROUP_LABELS_DE.personal, navGroups.personal)}
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
                {user?.name ?? NAV_UI_LABELS_DE.userFallback}
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
          {!collapsed && <span>{NAV_UI_LABELS_DE.logout}</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
