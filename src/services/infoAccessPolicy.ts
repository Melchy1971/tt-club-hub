import type { AppRole } from '@/types/auth';

export interface InfoAccessRule {
  canReadPublicInfo: boolean;
  canReadInternalInfo: boolean;
  canReadDeveloperArea: boolean;
}

export function resolveInfoAccess(role: AppRole | null | undefined): InfoAccessRule {
  const isElevated = role === 'admin' || role === 'vorstand' || role === 'developer';
  const isDeveloper = role === 'developer';

  return {
    canReadPublicInfo: true,
    canReadInternalInfo: isElevated,
    canReadDeveloperArea: isDeveloper,
  };
}
