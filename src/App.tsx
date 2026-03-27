import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { SeasonProvider } from "@/contexts/SeasonContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import Teams from "./pages/Teams";
import Matches from "./pages/Matches";
import SettingsPage from "./pages/SettingsPage";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import PlaceholderPage from "./pages/PlaceholderPage";
import ImportPage from "./pages/Import";
import Seasons from "./pages/Seasons";
import Roles from "./pages/Roles";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SeasonProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/mitglieder" element={<Members />} />
                  <Route path="/mannschaften" element={<Teams />} />
                  <Route path="/spielbetrieb" element={<Matches />} />
                  <Route path="/ersatzstellung" element={<PlaceholderPage title="Ersatzstellung" />} />
                  <Route path="/training" element={<PlaceholderPage title="Training" />} />
                  <Route path="/kommunikation" element={<PlaceholderPage title="Kommunikation" />} />
                  <Route path="/vorstand" element={<PlaceholderPage title="Vorstand" />} />
                  <Route path="/import" element={<ImportPage />} />
                  <Route path="/admin" element={<PlaceholderPage title="Administration" />} />
                  <Route path="/rollen" element={<Roles />} />
                  <Route path="/einstellungen" element={<SettingsPage />} />
                  <Route path="/saisons" element={<Seasons />} />
                  <Route path="/profil" element={<PlaceholderPage title="Profil" />} />
                  <Route path="/info" element={<PlaceholderPage title="Info" />} />
                </Route>
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
