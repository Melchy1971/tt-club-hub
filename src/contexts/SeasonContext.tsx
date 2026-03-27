import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Season } from '@/types';
import { seasonService } from '@/services/seasonService';

interface SeasonContextType {
  currentSeason: Season | null;
  setCurrentSeason: (season: Season) => void;
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
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadCurrentSeason = useCallback(async () => {
    try {
      setIsLoading(true);
      const season = await seasonService.getCurrent();
      setCurrentSeason(season);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentSeason();
  }, [loadCurrentSeason]);

  return (
    <SeasonContext.Provider value={{ currentSeason, setCurrentSeason, isLoading, refresh: loadCurrentSeason }}>
      {children}
    </SeasonContext.Provider>
  );
}

export const useSeason = () => useContext(SeasonContext);
