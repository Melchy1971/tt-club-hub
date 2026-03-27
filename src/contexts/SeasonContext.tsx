import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Season } from '@/types';
import { seasonService } from '@/services/seasonService';
import { useAuth } from '@/contexts/AuthContext';

interface SeasonContextType {
  currentSeason: Season | null;
  setCurrentSeason: (season: Season | null) => void;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const SeasonContext = createContext<SeasonContextType>({
  currentSeason: null,
  setCurrentSeason: () => {},
  isLoading: false,
  refresh: async () => {},
});

export function SeasonProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadCurrentSeason = useCallback(async () => {
    if (!isAuthenticated) {
      setCurrentSeason(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const season = await seasonService.getCurrent();
      setCurrentSeason(season);
    } catch {
      setCurrentSeason(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }

    void loadCurrentSeason();
  }, [authLoading, loadCurrentSeason]);

  return (
    <SeasonContext.Provider value={{ currentSeason, setCurrentSeason, isLoading, refresh: loadCurrentSeason }}>
      {children}
    </SeasonContext.Provider>
  );
}

export const useSeason = () => useContext(SeasonContext);
