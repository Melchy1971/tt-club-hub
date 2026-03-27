import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';
import type { AppRole, AuthContextValue, AuthProblem } from '@/types/auth';
import { APP_ROLES } from '@/types/auth';

const initialContext: AuthContextValue = {
  user: null,
  session: null,
  role: null,
  member: null,
  isLoading: true,
  isAuthenticated: false,
  problem: null,
  refresh: async () => {},
  signOut: async () => {},
};

const AuthContext = createContext<AuthContextValue>(initialContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthContextValue>(initialContext);

  const loadUserData = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setState((prev) => ({
        ...prev,
        user: null,
        session: null,
        role: null,
        member: null,
        isAuthenticated: false,
        problem: 'NO_SESSION',
        isLoading: false,
      }));
      return;
    }

    const supaUser: User = session.user;
    let problem: AuthProblem | null = null;

    // 1) Rollen laden
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', supaUser.id);

    if (roleError) {
      problem = 'UNKNOWN';
    }

    const primaryRole = roles?.[0]?.role as AppRole | undefined;
    const roleIsValid = primaryRole && APP_ROLES.includes(primaryRole);
    if (!roles?.length) {
      problem = 'NO_USER_ROLES';
    } else if (!roleIsValid) {
      problem = 'INVALID_ROLE';
    }

    // 2) Member-Profil laden
    const { data: member } = await supabase
      .from('members')
      .select('*')
      .eq('user_id', supaUser.id)
      .maybeSingle();

    if (!member) {
      problem = problem ?? 'MISSING_MEMBER';
    }

    setState((prev) => ({
      ...prev,
      user: {
        id: supaUser.id,
        email: supaUser.email ?? null,
        name: supaUser.user_metadata?.full_name ?? null,
        role: roleIsValid ? primaryRole! : null,
      },
      session,
      role: roleIsValid ? primaryRole! : null,
      member: member ?? null,
      isAuthenticated: !!(session && !problem && member && roleIsValid),
      problem,
      isLoading: false,
    }));
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setState((prev) => ({ ...prev, isLoading: true }));
      await loadUserData(newSession);
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      loadUserData(existing);
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState(initialContext);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await loadUserData(data.session);
  }, [loadUserData]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        refresh,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
