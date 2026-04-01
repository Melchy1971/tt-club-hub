import type { AppRole } from '@/types/auth';
import type { CommunicationAudience, PublicationStatus } from '@/types/domain/communication';

export type BoardActorRole = Extract<AppRole, 'admin' | 'developer' | 'vorstand' | 'trainer' | 'mitglied' | 'spieler'>;

export type BoardChannel = 'news' | 'meetings' | 'documents' | 'email' | 'lists';

export type BoardVisibility = Exclude<CommunicationAudience, 'all'>;

export interface BoardScope {
  channel: BoardChannel;
  visibility: BoardVisibility;
}

export interface BoardPermissionRule {
  role: BoardActorRole;
  canReadInternal: boolean;
  canWriteInternal: boolean;
  canDeleteInternal: boolean;
  canReadPublic: boolean;
  canWritePublic: boolean;
  canDeletePublic: boolean;
}

export interface BoardNewsFilter {
  visibility?: CommunicationAudience;
  status?: PublicationStatus;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface BoardMeetingFilter {
  visibility?: BoardVisibility;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface BoardDocumentFilter {
  visibility?: BoardVisibility;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface BoardEmailDraft {
  subject: string;
  body: string;
  listId?: string;
  visibility: BoardVisibility;
}

export interface BoardDistributionList {
  id: string;
  name: string;
  visibility: BoardVisibility;
  memberCount: number;
}
