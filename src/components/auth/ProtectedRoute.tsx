import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/types';
import { Loader2 } from 'lucide-react';
import { evaluateGuard, resolveRouteRedirect } from '@/lib/auth/guards';

interface ProtectedRouteProps {
  allowedRoles?: AppRole[];
  fallbackPath?: string;
}

export function ProtectedRoute({ allowedRoles, fallbackPath = '/' }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, roles, problem } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const guard = evaluateGuard({ isAuthenticated, roles, problem }, allowedRoles);
  const target = resolveRouteRedirect(guard, fallbackPath);
  if (target) {
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}
