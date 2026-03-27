import type { SeasonId } from '../api';

export type AgeGroup = 'erwachsene' | 'jugend';

export interface Season {
  readonly id: SeasonId;
  name: string;
  start_date: string; // ISO-Datum
  end_date: string; // ISO-Datum
  is_current: boolean;
  age_group: AgeGroup;
}

export type SeasonCreate = Omit<Season, 'id'>;
export type SeasonUpdate = Partial<SeasonCreate>;
