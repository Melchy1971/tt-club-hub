import { err, ok } from '@/lib/api';
import { boardAccessPolicy } from '@/services/boardAccessPolicy';
import { boardMeetingService } from '@/services/boardMeetingService';
import { communicationListService } from '@/services/communicationListService';
import { documentService } from '@/services/documentService';
import { meetingDocumentService } from '@/services/meetingDocumentService';
import { newsService } from '@/services/newsService';
import type { ApiResult } from '@/types/api';
import type {
  BoardActorRole,
  BoardDistributionList,
  BoardEmailDraft,
  BoardNewsFilter,
} from '@/types/domain/board';

/**
 * Board-Domain-Fassade:
 * - bündelt News, Sitzungen, Dokumente, E-Mail-Entwürfe und Listen
 * - setzt Zugriffsregeln auf Service-Ebene durch
 */
export const boardDomainService = {
  async listNews(role: BoardActorRole, filter: BoardNewsFilter = {}) {
    const visibility = filter.visibility === 'public' ? 'public' : 'internal';
    const auth = boardAccessPolicy.authorize(role, { channel: 'news', visibility }, 'read');
    if (!auth.success) return auth;
    return newsService.list({
      audience: visibility,
      status: filter.status,
      limit: filter.limit,
      offset: filter.offset,
      search: filter.search,
    });
  },

  async listMeetings(role: BoardActorRole) {
    return boardMeetingService.listForActor(role, { visibility: 'internal' });
  },

  async listMeetingDocuments(role: BoardActorRole, meetingId: string) {
    return meetingDocumentService.listForActor(role, meetingId, { visibility: 'internal' });
  },

  async listDocuments(role: BoardActorRole, visibility: 'public' | 'internal') {
    const auth = boardAccessPolicy.authorize(role, { channel: 'documents', visibility }, 'read');
    if (!auth.success) return auth;
    return documentService.list({ audience: visibility });
  },

  async listDistributionLists(role: BoardActorRole, visibility: 'public' | 'internal'): Promise<ApiResult<BoardDistributionList[]>> {
    const auth = boardAccessPolicy.authorize(role, { channel: 'lists', visibility }, 'read');
    if (!auth.success) return auth as ApiResult<BoardDistributionList[]>;

    const res = await communicationListService.listWithCounts();
    if (!res.success) return err(res.error);

    const mapped: BoardDistributionList[] = res.data
      .filter((list) => list.audience === visibility)
      .map((list) => ({
        id: list.id,
        name: list.name,
        visibility: list.audience,
        memberCount: list.memberCount ?? 0,
      }));

    return ok(mapped);
  },

  buildEmailDraft(role: BoardActorRole, input: BoardEmailDraft): ApiResult<BoardEmailDraft> {
    const auth = boardAccessPolicy.authorize(role, { channel: 'email', visibility: input.visibility }, 'write');
    if (!auth.success) return auth as ApiResult<BoardEmailDraft>;
    return ok(input);
  },
};
