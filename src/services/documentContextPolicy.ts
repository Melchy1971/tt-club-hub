import type { AppRole } from '@/types/auth';
import type { DocumentOwnerContext } from '@/types/domain/documentContext';

export type DocumentAction = 'read' | 'write' | 'delete';

const READ_MATRIX: Record<DocumentOwnerContext, AppRole[]> = {
  public: ['admin', 'developer', 'vorstand', 'trainer', 'mitglied', 'spieler'],
  communication: ['admin', 'developer', 'vorstand', 'trainer'],
  board_general: ['admin', 'developer', 'vorstand'],
  board_meeting: ['admin', 'developer', 'vorstand'],
};

const WRITE_MATRIX: Record<DocumentOwnerContext, AppRole[]> = {
  public: ['admin', 'developer', 'vorstand'],
  communication: ['admin', 'developer', 'vorstand'],
  board_general: ['admin', 'developer', 'vorstand'],
  board_meeting: ['admin', 'developer', 'vorstand'],
};

const DELETE_MATRIX: Record<DocumentOwnerContext, AppRole[]> = {
  public: ['admin', 'developer'],
  communication: ['admin', 'developer'],
  board_general: ['admin', 'developer'],
  board_meeting: ['admin', 'developer'],
};

export const documentContextPolicy = {
  can(role: AppRole, ownerContext: DocumentOwnerContext, action: DocumentAction): boolean {
    if (action === 'read') return READ_MATRIX[ownerContext].includes(role);
    if (action === 'write') return WRITE_MATRIX[ownerContext].includes(role);
    return DELETE_MATRIX[ownerContext].includes(role);
  },
};
