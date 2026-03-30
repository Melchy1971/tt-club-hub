import { z } from 'zod';

// ─── Status-Enum ──────────────────────────────────────────────────────────────

export const SUBSTITUTE_REQUEST_STATUSES = ['pending', 'accepted', 'declined', 'cancelled'] as const;
export type SubstituteRequestStatus = (typeof SUBSTITUTE_REQUEST_STATUSES)[number];

export const substituteStatusSchema = z.enum(SUBSTITUTE_REQUEST_STATUSES);

// ─── Erlaubte Status-Übergänge ────────────────────────────────────────────────
// Spiegelt fn_check_substitute_status_transition() exakt wider.

export const VALID_TRANSITIONS: Record<SubstituteRequestStatus, SubstituteRequestStatus[]> = {
  pending:   ['accepted', 'declined', 'cancelled'],
  accepted:  ['cancelled'],
  declined:  [],
  cancelled: [],
};

export function isValidTransition(
  from: SubstituteRequestStatus,
  to: SubstituteRequestStatus,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/** Terminale Status – kein weiterer Übergang möglich. */
export const TERMINAL_STATUSES = new Set<SubstituteRequestStatus>(['declined', 'cancelled']);

export function isTerminal(status: SubstituteRequestStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

// ─── Wer darf was? ────────────────────────────────────────────────────────────
// Abgeleitet aus ROLE_PERMISSIONS in types/auth.ts

export const ROLES_CAN_REQUEST    = ['admin', 'developer', 'vorstand', 'trainer', 'spieler'] as const;
export const ROLES_CAN_APPROVE    = ['admin', 'developer', 'vorstand', 'trainer'] as const;
export const ROLES_CAN_CANCEL_ANY = ['admin', 'developer', 'vorstand', 'trainer'] as const;

// ─── CRUD-Schemas ─────────────────────────────────────────────────────────────

export const substituteRequestCreateSchema = z.object({
  match_id:             z.string().uuid('Ungültige Spiel-ID'),
  requesting_team_id:   z.string().uuid('Ungültige Mannschafts-ID'),
  substitute_member_id: z.string().uuid('Ungültige Spieler-ID'),
  note:                 z.string().max(500, 'Notiz max. 500 Zeichen').nullable().optional(),
});

/** Nur Status + optionale resolution_note änderbar (keine anderen Felder). */
export const substituteRequestResolveSchema = z.object({
  status:          substituteStatusSchema.exclude(['pending']),
  resolution_note: z.string().max(500).nullable().optional(),
  resolved_by:     z.string().uuid().optional(), // wird service-seitig befüllt
});

export const substituteRequestFilterSchema = z.object({
  match_id:             z.string().uuid().optional(),
  requesting_team_id:   z.string().uuid().optional(),
  substitute_member_id: z.string().uuid().optional(),
  status:               substituteStatusSchema.optional(),
  season_id:            z.string().uuid().optional(),
  /** Nur offene Anfragen (pending) */
  open_only:            z.boolean().optional(),
  /** Anfragen ab diesem Datum (ISO) */
  from_date:            z.string().date().optional(),
  /** Anfragen bis zu diesem Datum (ISO) */
  to_date:              z.string().date().optional(),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type SubstituteRequestCreateInput  = z.infer<typeof substituteRequestCreateSchema>;
export type SubstituteRequestResolveInput = z.infer<typeof substituteRequestResolveSchema>;
export type SubstituteRequestFilterInput  = z.infer<typeof substituteRequestFilterSchema>;
