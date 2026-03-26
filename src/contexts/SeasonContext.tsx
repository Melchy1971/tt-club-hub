import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Season } from '@/types';

interface SeasonContextType {
  currentSeason: Season | null;
  setCurrentSeason: (season: Season) => void;
  isLoading: boolean;
}

const SeasonContext = createContext<SeasonContextType>({
  currentSeason: null,
  setCurrentSeason: () => {},
  isLoading: false,
});

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [isLoading] = useState(false);

  return (
    <SeasonContext.Provider value={{ currentSeason, setCurrentSeason, isLoading }}>
      {children}
    </SeasonContext.Provider>
  );
}

export const useSeason = () => useContext(SeasonContext);
