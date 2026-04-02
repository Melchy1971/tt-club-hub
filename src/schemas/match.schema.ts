/**
 * Match-Domain basiert auf `schedule_matches`.
 * Dieses File bietet Alias-Namen für bestehende Imports.
 */
export {
  matchStatusSchema,
  scheduleMatchCreateSchema as matchCreateSchema,
  scheduleMatchUpdateSchema as matchUpdateSchema,
  scheduleMatchFilterSchema as matchFilterSchema,
  matchResultUpdateSchema,
  matchRescheduleSchema,
  pinCodeUpdateSchema,
  bulkPinCodeSchema,
  type MatchStatusValue,
  type ScheduleMatchCreateInput as MatchCreateInput,
  type ScheduleMatchUpdateInput as MatchUpdateInput,
  type ScheduleMatchFilterInput as MatchFilterInput,
  type MatchResultUpdateInput,
  type MatchRescheduleInput,
  type PinCodeUpdateInput,
  type BulkPinCodeInput,
} from './schedule.schema';
