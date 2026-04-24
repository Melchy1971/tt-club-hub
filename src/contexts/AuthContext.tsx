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
import type { AuthContextValue, AppRole } from '@/types/auth';
import { resolveAuthUser, resolveSessionState } from '@/lib/auth/resolver';

const PREVIEW_ROLE_STORAGE_KEY = 'dev_preview_role';

const readStoredPreviewRole = (): AppRole | null => {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(PREVIEW_ROLE_STORAGE_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
};

const initialContext: AuthContextValue = {
  user: null,
  session: null,
  role: null,
  roles: [],
  member: null,
  isLoading: true,
  isAuthenticated: false,
  problem: null,
  problems: [],
  refresh: async () => {},
  signOut: async () => {},
  actualRole: null,
  actualRoles: [],
  previewRole: null,
  setPreviewRole: () => {},
};

const AuthContext = createContext<AuthContextValue>(initialContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthContextValue>({
    ...initialContext,
    isLoading: true,
  });
  const [previewRole, setPreviewRoleState] = useState<AppRole | null>(() => readStoredPreviewRole());
  const requestVersionRef = useRef(0);
  const initializedRef = useRef(false);

  const loadUserData = useCallback(async (session: Session | null) => {
    const requestVersion = ++requestVersionRef.current;

    if (!session?.user) {
      // No session – immediately stop loading (no async work needed)
      setState((prev) => ({
        ...prev,
        user: null,
        session: null,
        role: null,
        roles: [],
        member: null,
        isAuthenticated: false,
        problem: 'NO_SESSION',
        problems: ['NO_SESSION'],
        isLoading: false,
      }));
      return;
    }

    const supaUser: User = session.user;

    // Member zuerst laden, dann Rollen über member_id
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('*')
      .eq('user_id', supaUser.id)
      .maybeSingle();

    let roleRows: Array<{ role: string }> = [];
    let roleError: unknown = null;
    if (member?.id) {
      const { data, error } = await supabase
        .from('member_roles')
        .select('role')
        .eq('member_id', member.id);
      roleRows = data ?? [];
      roleError = error;
    }

    const resolved = resolveSessionState({
      session,
      userRoles: roleRows.map((entry) => ({ user_id: supaUser.id, role: entry.role })),
      member: member ?? null,
      roleError: !!roleError,
      memberError: !!memberError,
    });

    if (requestVersion !== requestVersionRef.current) return;

    setState((prev) => ({
      ...prev,
      user: resolveAuthUser(supaUser, resolved.primaryRole),
      session,
      role: resolved.primaryRole,
      roles: resolved.roles,
      member: resolved.member,
      isAuthenticated: resolved.isAuthenticated,
      problem: resolved.problems[0] ?? null,
      problems: resolved.problems,
      isLoading: false,
    }));
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Restore session first – this is the source of truth
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      if (!isMounted) return;
      initializedRef.current = true;
      void loadUserData(existing);
    });

    // Listen for subsequent changes (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      // Only set loading for changes AFTER initial load
      if (initializedRef.current) {
        setState((prev) => ({ ...prev, isLoading: true }));
      }
      void loadUserData(newSession);
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

  const setPreviewRole = useCallback((role: AppRole | null) => {
    setPreviewRoleState(role);
    if (typeof window === 'undefined') return;
    try {
      if (role) {
        window.localStorage.setItem(PREVIEW_ROLE_STORAGE_KEY, role);
      } else {
        window.localStorage.removeItem(PREVIEW_ROLE_STORAGE_KEY);
      }
    } catch {
      // ignore storage errors (private mode etc.)
    }
  }, []);

  // Preview-Rolle wird beim Logout zurückgesetzt
  const wrappedSignOut = useCallback(async () => {
    setPreviewRoleState(null);
    if (typeof window !== 'undefined') {
      try { window.localStorage.removeItem(PREVIEW_ROLE_STORAGE_KEY); } catch { /* ignore */ }
    }
    await signOut();
  }, [signOut]);

  // Effektive Rolle: Preview überschreibt Original (nur wenn authentifiziert)
  const effectiveRole = previewRole && state.isAuthenticated ? previewRole : state.role;
  const effectiveRoles = previewRole && state.isAuthenticated ? [previewRole] : state.roles;

  return (
    <AuthContext.Provider
      value={{
        ...state,
        role: effectiveRole,
        roles: effectiveRoles,
        actualRole: state.role,
        actualRoles: state.roles,
        previewRole,
        setPreviewRole,
        refresh,
        signOut: wrappedSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
