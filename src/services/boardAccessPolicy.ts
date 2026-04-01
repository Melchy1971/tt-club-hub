import { err, ok } from '@/lib/api';
import { errors } from '@/lib/error';
import type { ApiResult } from '@/types/api';
import type {
  BoardActorRole,
  BoardPermissionRule,
  BoardScope,
} from '@/types/domain/board';

const BOARD_PERMISSION_RULES: Record<BoardActorRole, BoardPermissionRule> = {
  developer: {
    role: 'developer',
    canReadInternal: true,
    canWriteInternal: true,
    canDeleteInternal: true,
    canReadPublic: true,
    canWritePublic: true,
    canDeletePublic: true,
  },
  admin: {
    role: 'admin',
    canReadInternal: true,
    canWriteInternal: true,
    canDeleteInternal: true,
    canReadPublic: true,
    canWritePublic: true,
    canDeletePublic: true,
  },
  vorstand: {
    role: 'vorstand',
    canReadInternal: true,
    canWriteInternal: true,
    canDeleteInternal: false,
    canReadPublic: true,
    canWritePublic: true,
    canDeletePublic: false,
  },
  trainer: {
    role: 'trainer',
    canReadInternal: false,
    canWriteInternal: false,
    canDeleteInternal: false,
    canReadPublic: true,
    canWritePublic: false,
    canDeletePublic: false,
  },
  spieler: {
    role: 'spieler',
    canReadInternal: false,
    canWriteInternal: false,
    canDeleteInternal: false,
    canReadPublic: true,
    canWritePublic: false,
    canDeletePublic: false,
  },
  mitglied: {
    role: 'mitglied',
    canReadInternal: false,
    canWriteInternal: false,
    canDeleteInternal: false,
    canReadPublic: true,
    canWritePublic: false,
    canDeletePublic: false,
  },
};

type Action = 'read' | 'write' | 'delete';

function allowed(rule: BoardPermissionRule, scope: BoardScope, action: Action): boolean {
  if (scope.visibility === 'internal') {
    if (action === 'read') return rule.canReadInternal;
    if (action === 'write') return rule.canWriteInternal;
    return rule.canDeleteInternal;
  }

  if (action === 'read') return rule.canReadPublic;
  if (action === 'write') return rule.canWritePublic;
  return rule.canDeletePublic;
}

export const boardAccessPolicy = {
  getRule(role: BoardActorRole): BoardPermissionRule {
    return BOARD_PERMISSION_RULES[role];
  },

  authorize(role: BoardActorRole, scope: BoardScope, action: Action): ApiResult<void> {
    const rule = BOARD_PERMISSION_RULES[role];
    if (!allowed(rule, scope, action)) {
      return err(errors.forbidden(`${role} darf ${action} auf ${scope.visibility}/${scope.channel} nicht ausführen.`));
    }
    return ok(undefined);
  },
};
