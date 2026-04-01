export type AgeGroup =
  | 'herren'
  | 'damen'
  | 'jungen_18'
  | 'maedchen_18'
  | 'jungen_15'
  | 'maedchen_15'
  | 'jungen_13'
  | 'maedchen_13'
  | 'jungen_11'
  | 'maedchen_11'
  | 'senioren'
  | 'seniorinnen';

export type PhaseType = 'first_half' | 'second_half' | 'single_half';

export interface SeasonCycle {
  readonly id: string;
  name: string;
  start_year: number;
  end_year: number;
  age_group: AgeGroup;
  is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface SeasonPhase {
  readonly id: string;
  season_cycle_id: string;
  phase_type: PhaseType;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  sort_order: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export type SeasonCycleCreate = Omit<SeasonCycle, 'id' | 'created_at' | 'updated_at'>;
export type SeasonCycleUpdate = Partial<SeasonCycleCreate>;
export type SeasonPhaseCreate = Omit<SeasonPhase, 'id' | 'created_at' | 'updated_at'>;
export type SeasonPhaseUpdate = Partial<SeasonPhaseCreate>;
