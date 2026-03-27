import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/types';
import { Loader2 } from 'lucide-react';
import { evaluateGuard } from '@/lib/auth/guards';

interface ProtectedRouteProps {
  allowedRoles?: AppRole[];
  fallbackPath?: string;
}

export function ProtectedRoute({ allowedRoles, fallbackPath = '/' }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, role, problem } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const guard = evaluateGuard({ isAuthenticated, role, problem }, allowedRoles);
  if (!guard.allowed) {
    // fehlendes Profil → zurück zur Auth-Seite, damit ggf. Onboarding greift
    const target =
      guard.reason === 'MISSING_MEMBER' || guard.reason === 'NO_USER_ROLES'
        ? '/auth'
        : fallbackPath;
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}
