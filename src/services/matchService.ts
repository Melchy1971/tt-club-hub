import { scheduleService, type ScheduleMatchUI } from '@/services/scheduleService';
import type {
  MatchRescheduleInput,
  MatchResultUpdateInput,
  PinCodeUpdateInput,
  ScheduleMatchCreateInput,
  ScheduleMatchFilterInput,
  ScheduleMatchUpdateInput,
} from '@/schemas/schedule.schema';
import type { ApiResult } from '@/types/api';

/**
 * Match-Domain Facade auf Basis von `schedule_matches`.
 * Hält die ältere API (`matchService`) kompatibel und delegiert an `scheduleService`.
 */
export const matchService = {
  async list(filter: ScheduleMatchFilterInput = {}): Promise<ApiResult<ScheduleMatchUI[]>> {
    return scheduleService.list(filter);
  },

  async getById(id: string): Promise<ApiResult<ScheduleMatchUI>> {
    return scheduleService.getById(id);
  },

  async getByTeam(teamId: string): Promise<ApiResult<ScheduleMatchUI[]>> {
    return scheduleService.list({ team_id: teamId });
  },

  async getBySeasonPhase(seasonPhaseId: string): Promise<ApiResult<ScheduleMatchUI[]>> {
    return scheduleService.listBySeasonPhase(seasonPhaseId);
  },

  async create(match: ScheduleMatchCreateInput): Promise<ApiResult<ScheduleMatchUI>> {
    return scheduleService.create(match);
  },

  async update(id: string, updates: ScheduleMatchUpdateInput): Promise<ApiResult<ScheduleMatchUI>> {
    return scheduleService.update(id, updates);
  },

  async updateResult(id: string, input: MatchResultUpdateInput): Promise<ApiResult<ScheduleMatchUI>> {
    return scheduleService.updateResult(id, input);
  },

  async reschedule(id: string, input: MatchRescheduleInput): Promise<ApiResult<ScheduleMatchUI>> {
    return scheduleService.reschedule(id, input);
  },

  async updatePinCode(id: string, input: PinCodeUpdateInput): Promise<ApiResult<ScheduleMatchUI>> {
    return scheduleService.updatePinCode(id, input);
  },

  async bulkUpdatePinCode(
    input: Array<{ id: string; pin?: string | null; code?: string | null }>,
  ): ReturnType<typeof scheduleService.bulkUpdatePinCode> {
    return scheduleService.bulkUpdatePinCode(input);
  },

  async remove(id: string): Promise<ApiResult<void>> {
    return scheduleService.remove(id);
  },
};
