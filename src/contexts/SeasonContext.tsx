import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { SeasonPhase } from '@/types';
import { seasonPhaseService } from '@/services/seasonCycleService';
import { useAuth } from '@/contexts/AuthContext';

interface SeasonContextType {
  /** Die aktuell aktive Saisonphase (Halb-/Rückrunde) */
  currentPhase: SeasonPhase | null;
  setCurrentPhase: (phase: SeasonPhase | null) => void;
  isLoading: boolean;
  refresh: () => Promise<void>;
  /** @deprecated Verwende currentPhase */
  currentSeason: SeasonPhase | null;
}

const SeasonContext = createContext<SeasonContextType>({
  currentPhase: null,
  setCurrentPhase: () => {},
  isLoading: false,
  refresh: async () => {},
  currentSeason: null,
});

export function SeasonProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [currentPhase, setCurrentPhase] = useState<SeasonPhase | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadCurrentPhase = useCallback(async () => {
    if (!isAuthenticated) {
      setCurrentPhase(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const phase = await seasonPhaseService.getActive();
      setCurrentPhase(phase);
    } catch {
      setCurrentPhase(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }
    void loadCurrentPhase();
  }, [authLoading, loadCurrentPhase]);

  return (
    <SeasonContext.Provider
      value={{
        currentPhase,
        setCurrentPhase,
        isLoading,
        refresh: loadCurrentPhase,
        // backward compat: currentSeason maps to currentPhase
        currentSeason: currentPhase,
      }}
    >
      {children}
    </SeasonContext.Provider>
  );
}

export const useSeason = () => useContext(SeasonContext);
