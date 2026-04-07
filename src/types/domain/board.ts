import type { AppRole } from '@/types/auth';
import type { CommunicationAudience, PublicationStatus } from '@/types/domain/communication';

export type BoardActorRole = Extract<AppRole, 'admin' | 'developer' | 'vorstand' | 'trainer' | 'mitglied' | 'spieler'>;

export type BoardChannel = 'members' | 'news' | 'meetings' | 'documents' | 'email' | 'lists';

export type BoardVisibility = Exclude<CommunicationAudience, 'all'>;

export type BoardMeetingStatus = 'planned' | 'confirmed' | 'completed' | 'cancelled';

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

export interface BoardMemberFilter {
  activeOnly?: boolean;
  role?: 'vorstand' | 'admin';
}

export interface BoardMemberRow {
  id: string;
  user_id: string;
  member_id: string | null;
  position: string;
  term_start: string | null;
  term_end: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
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
  status?: BoardMeetingStatus;
  limit?: number;
  offset?: number;
}

export interface BoardDocumentFilter {
  visibility?: BoardVisibility;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface BoardMeetingRow {
  id: string;
  title: string;
  topic: string;
  status: BoardMeetingStatus;
  meeting_date: string;
  meeting_time: string | null;
  location: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
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

export interface BoardEdgeCase {
  key: string;
  description: string;
}

export interface BoardSecurityRisk {
  key: string;
  description: string;
  mitigation: string;
}

export const BOARD_EDGE_CASES: BoardEdgeCase[] = [
  {
    key: 'member_without_profile',
    description: 'board_members-Eintrag ohne verknüpften members-Datensatz (z. B. gelöschtes Mitglied).',
  },
  {
    key: 'meeting_without_documents',
    description: 'Sitzungen ohne Protokoll oder Anhang müssen weiterhin lesbar/listbar bleiben.',
  },
  {
    key: 'stale_active_flag',
    description: 'Abgelaufene Amtszeiten (term_end in der Vergangenheit), aber is_active noch true.',
  },
  {
    key: 'orphan_documents',
    description: 'Datei im Storage vorhanden, aber DB-Insert in meeting_documents fehlgeschlagen.',
  },
];

export const BOARD_SECURITY_RISKS: BoardSecurityRisk[] = [
  {
    key: 'overly_broad_select',
    description: 'Zu breite SELECT-RLS auf meetings/meeting_documents kann interne Inhalte leaken.',
    mitigation: 'RLS auf has_role(auth.uid(), admin|vorstand) einschränken und Service-Guards erzwingen.',
  },
  {
    key: 'public_storage_urls',
    description: 'Öffentliche Bucket-URLs können an Unberechtigte weitergegeben werden.',
    mitigation: 'Interne Dokumente in private Buckets speichern und signierte URLs mit kurzer TTL verwenden.',
  },
  {
    key: 'role_drift',
    description: 'Benutzer verliert Vorstandsrolle, bleibt aber in board_members aktiv.',
    mitigation: 'Synchronisations-Check zwischen board_members und user_roles bei Schreiboperationen.',
  },
];
