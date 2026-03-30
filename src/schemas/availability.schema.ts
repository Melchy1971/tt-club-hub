import { z } from 'zod';

// ─── Availability-Status ──────────────────────────────────────────────────────

export const AVAILABILITY_STATUS = ['unknown', 'available', 'unavailable', 'uncertain'] as const;
export type AvailabilityStatusValue = (typeof AVAILABILITY_STATUS)[number];

export const availabilityStatusSchema = z.enum(AVAILABILITY_STATUS);

// ─── Einzelner Verfügbarkeits-Eintrag ────────────────────────────────────────

export const availabilitySetSchema = z.object({
  match_id:  z.string().uuid('Ungültige Spiel-ID'),
  member_id: z.string().uuid('Ungültige Mitglieds-ID'),
  team_id:   z.string().uuid('Ungültige Mannschafts-ID'),
  status:    availabilityStatusSchema.default('unknown'),
  note:      z.string().max(500, 'Notiz max. 500 Zeichen').nullable().optional(),
});

// ─── Bulk-Update (z.B. "alle auf 'unknown' zurücksetzen") ────────────────────

export const availabilityBulkEntrySchema = z.object({
  member_id: z.string().uuid('Ungültige Mitglieds-ID'),
  status:    availabilityStatusSchema,
  note:      z.string().max(500).nullable().optional(),
});

export const availabilityBulkSchema = z.object({
  match_id:  z.string().uuid('Ungültige Spiel-ID'),
  team_id:   z.string().uuid('Ungültige Mannschafts-ID'),
  entries:   z
    .array(availabilityBulkEntrySchema)
    .min(1, 'Mindestens ein Eintrag')
    .max(30, 'Maximal 30 Einträge pro Batch'),
});

// ─── Filter ──────────────────────────────────────────────────────────────────

export const availabilityFilterSchema = z.object({
  match_id:  z.string().uuid().optional(),
  team_id:   z.string().uuid().optional(),
  member_id: z.string().uuid().optional(),
  status:    availabilityStatusSchema.optional(),
});

// ─── Aufstellung (match_lineups) ─────────────────────────────────────────────

/**
 * Aufstellungs-Positionen im DTTB-Format:
 *   1–6   → Einzel (nummeriert nach Setzliste)
 *   7–8   → Doppel-Paar-Slots (Paar A = 7, Paar B = 8)
 *   9     → Reserve-/Doppel-Spieler in manchen Formaten
 *
 * Andere Formate (z.B. 4+2) nutzen 1–4 Einzel + 5–6 Doppel.
 * position=9 bleibt als Erweiterungsraum erhalten.
 */
export const LINEUP_POSITION_MIN = 1;
export const LINEUP_POSITION_MAX = 9;

export const lineupPositionSchema = z
  .number()
  .int()
  .min(LINEUP_POSITION_MIN, `Position min. ${LINEUP_POSITION_MIN}`)
  .max(LINEUP_POSITION_MAX, `Position max. ${LINEUP_POSITION_MAX}`);

export const lineupEntrySchema = z.object({
  member_id:    z.string().uuid('Ungültige Mitglieds-ID'),
  position:     lineupPositionSchema,
  is_substitute: z.boolean().default(false),
});

export const lineupSetSchema = z.object({
  match_id: z.string().uuid('Ungültige Spiel-ID'),
  team_id:  z.string().uuid('Ungültige Mannschafts-ID'),
  entries:  z
    .array(lineupEntrySchema)
    .max(LINEUP_POSITION_MAX, `Maximal ${LINEUP_POSITION_MAX} Spieler in der Aufstellung`)
    .superRefine((entries, ctx) => {
      // Positionen dürfen sich nicht wiederholen
      const positions = entries.map((e) => e.position);
      const uniquePositions = new Set(positions);
      if (uniquePositions.size !== positions.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Aufstellungs-Positionen müssen eindeutig sein',
        });
      }
      // Spieler dürfen nicht doppelt stehen
      const memberIds = entries.map((e) => e.member_id);
      const uniqueMembers = new Set(memberIds);
      if (uniqueMembers.size !== memberIds.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Ein Spieler darf nur einmal in der Aufstellung stehen',
        });
      }
    }),
});

export const lineupAddPlayerSchema = z.object({
  match_id:     z.string().uuid('Ungültige Spiel-ID'),
  team_id:      z.string().uuid('Ungültige Mannschafts-ID'),
  member_id:    z.string().uuid('Ungültige Mitglieds-ID'),
  position:     lineupPositionSchema,
  is_substitute: z.boolean().default(false),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type AvailabilitySetInput    = z.infer<typeof availabilitySetSchema>;
export type AvailabilityBulkInput   = z.infer<typeof availabilityBulkSchema>;
export type AvailabilityFilterInput = z.infer<typeof availabilityFilterSchema>;
export type LineupEntry             = z.infer<typeof lineupEntrySchema>;
export type LineupSetInput          = z.infer<typeof lineupSetSchema>;
export type LineupAddPlayerInput    = z.infer<typeof lineupAddPlayerSchema>;
