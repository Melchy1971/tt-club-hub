import { createContext, useContext, useState, type ReactNode } from 'react';
import type { AppRole } from '@/types';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  role: AppRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  isLoading: false,
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  // Stub – wird später mit Lovable Cloud verbunden
  const [user] = useState<User | null>(null);
  const [role] = useState<AppRole | null>(null);
  const [isLoading] = useState(false);

  return (
    <AuthContext.Provider value={{ user, role, isLoading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
