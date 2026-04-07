import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SeasonProvider } from '@/contexts/SeasonContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { ROUTES } from '@/routes/navigation';
import { isGuardAllowed } from '@/routes/guardMapping';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Teams from './pages/Teams';
import Matches from './pages/Matches';
import Schedule from './pages/Schedule';
import TeamSchedule from './pages/TeamSchedule';
import Substitutes from './pages/Substitutes';
import SettingsPage from './pages/SettingsPage';
import Auth from './pages/Auth';
import ResetPassword from './pages/ResetPassword';
import NotFound from './pages/NotFound';
import Admin from './pages/Admin';
import Communication from './pages/Communication';
import Board from './pages/Board';
import Training from './pages/Training';
import ImportPage from './pages/Import';
import Seasons from './pages/Seasons';
import Roles from './pages/Roles';
import Profile from './pages/Profile';

type AppRouteComponentMap = Record<string, React.ComponentType>;

const queryClient = new QueryClient();

const APP_ROUTE_COMPONENTS: AppRouteComponentMap = {
  '/': Dashboard,
  '/mitglieder': Members,
  '/mannschaften': Teams,
  '/spielbetrieb': Matches,
  '/spielplan': Schedule,
  '/ersatzstellung': Substitutes,
  '/training': Training,
  '/kommunikation': Communication,
  '/vorstand': Board,
  '/import': ImportPage,
  '/admin': Admin,
  '/rollen': Roles,
  '/einstellungen': SettingsPage,
  '/saisons': Seasons,
  '/profil': Profile,
  '/login': Auth,
};

function GuardedElement({ path, children }: { path: string; children: React.ReactNode }) {
  const { role, roles, isAuthenticated } = useAuth();
  const route = ROUTES.find((entry) => entry.path === path);

  if (!route) return <Navigate to="/404" replace />;

  const allowed = isGuardAllowed(
    { role, roles, isAuthenticated },
    route.guard,
  );

  if (!allowed) {
    return <Navigate to={isAuthenticated ? '/' : '/login'} replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SeasonProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route element={<AppLayout />}>
                {ROUTES.map((route) => {
                  if (route.path === '/login') return null;
                  const RouteComponent = APP_ROUTE_COMPONENTS[route.path];
                  if (!RouteComponent) return null;
                  return (
                    <Route
                      key={route.path}
                      path={route.path}
                      element={(
                        <GuardedElement path={route.path}>
                          <RouteComponent />
                        </GuardedElement>
                      )}
                    />
                  );
                })}
                <Route
                  path="/spielplan/team/:teamId"
                  element={(
                    <GuardedElement path="/spielplan">
                      <TeamSchedule />
                    </GuardedElement>
                  )}
                />
                <Route path="/info" element={<Navigate to="/einstellungen?tab=general" replace />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </SeasonProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
