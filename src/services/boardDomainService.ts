import { err, ok } from '@/lib/api';
import { boardAccessPolicy } from '@/services/boardAccessPolicy';
import { boardMeetingService, type BoardMeetingCreateDTO, type BoardMeetingUpdateDTO } from '@/services/boardMeetingService';
import {
  boardMemberService,
  type BoardMemberCreateDTO,
  type BoardMemberUpdateDTO,
} from '@/services/boardMemberService';
import { communicationListService } from '@/services/communicationListService';
import { documentService } from '@/services/documentService';
import {
  meetingDocumentService,
  type MeetingDocumentUploadDTO,
} from '@/services/meetingDocumentService';
import { newsService } from '@/services/newsService';
import type { NewsCreateDTO, NewsUpdateDTO } from '@/types/domain/news';
import type { ApiResult } from '@/types/api';
import type {
  BoardActorRole,
  BoardDistributionList,
  BoardEmailDraft,
  BoardMemberFilter,
  BoardMeetingFilter,
  BoardNewsFilter,
} from '@/types/domain/board';

/**
 * Board-Domain-Fassade:
 * - modelliert board_members, board_meetings und meeting_documents
 * - trennt Vorstands- von allgemeinen Mitgliedsdaten
 * - kapselt Zugriffsregeln für interne Inhalte
 * - bietet API-Adapter für News-Editor und Listenmodul
 */
export const boardDomainService = {
  // ── Board Members ──────────────────────────────────────────

  async listBoardMembers(role: BoardActorRole, filter: BoardMemberFilter = {}) {
    return boardMemberService.listForActor(role, filter);
  },

  async createBoardMember(role: BoardActorRole, payload: BoardMemberCreateDTO) {
    return boardMemberService.createForActor(role, payload);
  },

  async updateBoardMember(role: BoardActorRole, id: string, payload: BoardMemberUpdateDTO) {
    return boardMemberService.updateForActor(role, id, payload);
  },

  async removeBoardMember(role: BoardActorRole, id: string) {
    return boardMemberService.removeForActor(role, id);
  },

  // ── News (anschlussfähig für Editor) ───────────────────────

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

  async createNews(role: BoardActorRole, payload: NewsCreateDTO) {
    const visibility = payload.is_published ? 'public' : 'internal';
    const auth = boardAccessPolicy.authorize(role, { channel: 'news', visibility }, 'write');
    if (!auth.success) return auth;
    return newsService.create(payload);
  },

  async updateNews(role: BoardActorRole, id: string, payload: NewsUpdateDTO) {
    const visibility = payload.is_published ? 'public' : 'internal';
    const auth = boardAccessPolicy.authorize(role, { channel: 'news', visibility }, 'write');
    if (!auth.success) return auth;
    return newsService.update(id, payload);
  },

  async removeNews(role: BoardActorRole, id: string) {
    const auth = boardAccessPolicy.authorize(role, { channel: 'news', visibility: 'internal' }, 'delete');
    if (!auth.success) return auth;
    return newsService.remove(id);
  },

  // ── Meetings + Documents ───────────────────────────────────

  async listMeetings(role: BoardActorRole, filter: BoardMeetingFilter = {}) {
    return boardMeetingService.listForActor(role, { ...filter, visibility: 'internal' });
  },

  async createMeeting(role: BoardActorRole, payload: BoardMeetingCreateDTO) {
    return boardMeetingService.createForActor(role, payload);
  },

  async updateMeeting(role: BoardActorRole, id: string, payload: BoardMeetingUpdateDTO) {
    return boardMeetingService.updateForActor(role, id, payload);
  },

  async removeMeeting(role: BoardActorRole, id: string) {
    return boardMeetingService.removeForActor(role, id);
  },

  async listMeetingDocuments(role: BoardActorRole, meetingId: string) {
    return meetingDocumentService.listForActor(role, meetingId, { visibility: 'internal' });
  },

  async uploadMeetingDocument(role: BoardActorRole, meetingId: string, file: File, payload: MeetingDocumentUploadDTO) {
    return meetingDocumentService.uploadForActor(role, meetingId, file, payload);
  },

  async removeMeetingDocument(role: BoardActorRole, id: string) {
    return meetingDocumentService.removeForActor(role, id);
  },

  async listDocuments(role: BoardActorRole, visibility: 'public' | 'internal') {
    const auth = boardAccessPolicy.authorize(role, { channel: 'documents', visibility }, 'read');
    if (!auth.success) return auth;
    return documentService.list({ audience: visibility });
  },

  // ── Lists + Mail (anschlussfähig für Listenfunktion) ──────

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

  async buildEmailDraft(role: BoardActorRole, input: BoardEmailDraft): Promise<ApiResult<BoardEmailDraft>> {
    const auth = boardAccessPolicy.authorize(role, { channel: 'email', visibility: input.visibility }, 'write');
    if (!auth.success) return auth as ApiResult<BoardEmailDraft>;
    return ok(input);
  },
};
