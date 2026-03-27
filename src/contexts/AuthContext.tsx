import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
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

const ROLE_PRIORITY: AppRole[] = ['developer', 'admin', 'vorstand', 'trainer', 'spieler', 'mitglied'];

const resolvePrimaryRole = (roles: Array<{ role: AppRole | null }> | null | undefined): AppRole | null => {
  const validRoles = (roles ?? [])
    .map((entry) => entry.role)
    .filter((role): role is AppRole => !!role && APP_ROLES.includes(role));

  for (const candidate of ROLE_PRIORITY) {
    if (validRoles.includes(candidate)) return candidate;
  }

  return null;
};

const AuthContext = createContext<AuthContextValue>(initialContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthContextValue>(initialContext);
  const requestVersionRef = useRef(0);

  const loadUserData = useCallback(async (session: Session | null) => {
    const requestVersion = ++requestVersionRef.current;

    if (!session?.user) {
      if (requestVersion !== requestVersionRef.current) return;
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

    const [{ data: roles, error: roleError }, { data: member, error: memberError }] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', supaUser.id),
      supabase.from('members').select('*').eq('user_id', supaUser.id).maybeSingle(),
    ]);

    if (roleError || memberError) {
      problem = 'UNKNOWN';
    }

    const primaryRole = resolvePrimaryRole((roles as Array<{ role: AppRole | null }>) ?? []);
    const roleIsValid = !!primaryRole;

    if (!roles?.length) {
      problem = 'NO_USER_ROLES';
    } else if (!roleIsValid) {
      problem = 'INVALID_ROLE';
    }

    if (!member) {
      problem = problem ?? 'MISSING_MEMBER';
    }

    if (requestVersion !== requestVersionRef.current) return;

    setState((prev) => ({
      ...prev,
      user: {
        id: supaUser.id,
        email: supaUser.email ?? null,
        name:
          supaUser.user_metadata?.full_name ??
          ([supaUser.user_metadata?.first_name, supaUser.user_metadata?.last_name]
            .filter(Boolean)
            .join(' ') || null),
        role: roleIsValid ? primaryRole : null,
      },
      session,
      role: roleIsValid ? primaryRole : null,
      member: member ?? null,
      isAuthenticated: !!(session && !problem && member && roleIsValid),
      problem,
      isLoading: false,
    }));
  }, []);

  useEffect(() => {
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setState((prev) => ({ ...prev, isLoading: true }));
      void loadUserData(newSession);
    });

    void supabase.auth.getSession().then(({ data: { session: existing } }) => {
      if (!isMounted) return;
      void loadUserData(existing);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    requestVersionRef.current += 1;
    setState(initialContext);
  }, []);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
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
