import { z } from 'zod';

// ─── Status-Enum ──────────────────────────────────────────────────────────────
// DB-Enum substitute_status: pending | accepted | rejected
// 'cancelled' erfordert: ALTER TYPE substitute_status ADD VALUE 'cancelled';

export const SUBSTITUTE_REQUEST_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
] as const;

export type SubstituteRequestStatus = (typeof SUBSTITUTE_REQUEST_STATUSES)[number];

export const substituteStatusSchema = z.enum(SUBSTITUTE_REQUEST_STATUSES);

// ─── Erlaubte Status-Übergänge ────────────────────────────────────────────────
//
//  pending ──┬──► accepted ──► cancelled
//            ├──► rejected        (terminal)
//            └──► cancelled       (terminal)

export const VALID_TRANSITIONS: Record<SubstituteRequestStatus, SubstituteRequestStatus[]> = {
  pending:   ['accepted', 'rejected', 'cancelled'],
  accepted:  ['cancelled'],
  rejected:  [],
  cancelled: [],
};

export function isValidTransition(
  from: SubstituteRequestStatus,
  to: SubstituteRequestStatus,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/** Terminale Status – kein weiterer Übergang möglich. */
export const TERMINAL_STATUSES = new Set<SubstituteRequestStatus>(['rejected', 'cancelled']);

export function isTerminal(status: SubstituteRequestStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

// ─── Rollen-Berechtigungen ────────────────────────────────────────────────────

export const ROLES_CAN_REQUEST    = ['admin', 'developer', 'vorstand', 'trainer', 'spieler'] as const;
export const ROLES_CAN_APPROVE    = ['admin', 'developer', 'vorstand', 'trainer'] as const;
export const ROLES_CAN_CANCEL_ANY = ['admin', 'developer', 'vorstand', 'trainer'] as const;

// ─── Erstell-Schema ───────────────────────────────────────────────────────────
// created_by wird service-seitig aus dem Auth-Kontext befüllt.

export const substituteRequestCreateSchema = z.object({
  match_id:             z.string().uuid('Ungültige Spiel-ID'),
  team_id:              z.string().uuid('Ungültige Mannschafts-ID'),
  requesting_member_id: z.string().uuid('Ungültige Anfragesteller-ID'),
  substitute_member_id: z.string().uuid('Ungültige Ersatzspieler-ID'),
  note:                 z.string().max(500, 'Notiz max. 500 Zeichen').nullable().optional(),
});

// ─── Auflösungs-Schema ────────────────────────────────────────────────────────
// Wird für accept / reject / cancel verwendet.

export const substituteRequestResolveSchema = z.object({
  /** Zielstatus – pending ist kein gültiger Übergang. */
  status: substituteStatusSchema.exclude(['pending']),
});

// ─── Filter-Schema ────────────────────────────────────────────────────────────

export const substituteRequestFilterSchema = z.object({
  match_id:             z.string().uuid().optional(),
  team_id:              z.string().uuid().optional(),
  requesting_member_id: z.string().uuid().optional(),
  substitute_member_id: z.string().uuid().optional(),
  status:               substituteStatusSchema.optional(),
  /** Filtert über schedule_matches.season_phase_id (erfordert JOIN). */
  season_phase_id:      z.string().uuid().optional(),
  /** Nur offene Anfragen (status = pending). */
  open_only:            z.boolean().optional(),
  /** Anfragen ab diesem Match-Datum (ISO YYYY-MM-DD). */
  from_date:            z.string().date().optional(),
  /** Anfragen bis zu diesem Match-Datum (ISO YYYY-MM-DD). */
  to_date:              z.string().date().optional(),
});

// ─── Inferred Input-Typen ─────────────────────────────────────────────────────

export type SubstituteRequestCreateInput  = z.infer<typeof substituteRequestCreateSchema>;
export type SubstituteRequestResolveInput = z.infer<typeof substituteRequestResolveSchema>;
export type SubstituteRequestFilterInput  = z.infer<typeof substituteRequestFilterSchema>;
