import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/types';
import { evaluateGuard } from '@/lib/auth/guards';

export const useAuthGuard = (allowedRoles?: AppRole | AppRole[]) => {
  const auth = useAuth();
  const guard = evaluateGuard(
    { isAuthenticated: auth.isAuthenticated, roles: auth.roles, problem: auth.problem },
    allowedRoles
  );

  return { auth, guard };
};
