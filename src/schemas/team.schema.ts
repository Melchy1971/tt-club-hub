import { z } from 'zod';

// Alle gültigen Altersklassen – spiegelt das DB-Enum age_group wider.
export const AGE_GROUP_VALUES = [
  'herren',
  'damen',
  'jungen_18',
  'maedchen_18',
  'jungen_15',
  'maedchen_15',
  'jungen_13',
  'maedchen_13',
  'jungen_11',
  'maedchen_11',
  'senioren',
  'seniorinnen',
] as const;

export const ageGroupSchema = z.enum(AGE_GROUP_VALUES);

// ─── Team CRUD ───────────────────────────────────────────────────────────────

export const teamCreateSchema = z.object({
  name: z.string().trim().min(1, 'Mannschaftsname ist erforderlich').max(100),
  // league ist in der DB nullable; im UI aber Pflichtfeld → min(1) erzwingen.
  league: z.string().trim().min(1, 'Liga ist erforderlich').max(100),
  season_id: z.string().uuid('Ungültige Saison-ID'),
  season_phase_id: z.string().uuid('Ungültige Saisonphasen-ID'),
  age_group: ageGroupSchema.default('herren'),
  division: z.string().trim().max(50).nullable().optional(),
  captain_id: z.string().uuid('Ungültige Spielführer-ID').nullable().optional(),
  is_active: z.boolean().default(true),
});

export const teamUpdateSchema = teamCreateSchema.partial();

export const teamFilterSchema = z.object({
  is_active: z.boolean().optional(),
  season_id: z.string().uuid().optional(),
  season_phase_id: z.string().uuid().optional(),
  /** Wenn true, wird auf die aktive Saisonphase (season_phases.is_active=true) gefiltert. */
  active_phase: z.boolean().optional(),
  /** @deprecated Backward-Compat: nutzt weiterhin seasons.is_current=true. */
  active_season: z.boolean().optional(),
});

// ─── Team-Spieler-Zuordnung ───────────────────────────────────────────────────

/**
 * Position 0 ist DB-seitig erlaubt (chk_team_member_position: position >= 0).
 * 0 steht semantisch für „ohne feste Aufstellungsposition".
 * Positionen 1-20 sind nummerierte Plätze im Kader.
 */
export const positionSchema = z.number().int().min(0).max(20);

export const teamAssignmentSchema = z.object({
  team_id: z.string().uuid('Ungültige Mannschafts-ID'),
  member_id: z.string().uuid('Ungültige Mitglieds-ID'),
  position: positionSchema,
});

/** Ein einzelner Kader-Eintrag für setRoster (ohne team_id, da die vom Aufrufer kommt). */
export const rosterEntrySchema = z.object({
  member_id: z.string().uuid('Ungültige Mitglieds-ID'),
  position: positionSchema,
});

/**
 * Kompletter Kader-Austausch.
 * Validierung: Positionen > 0 müssen eindeutig sein.
 * Mehrere Einträge mit Position 0 sind möglich (alle ohne feste Position).
 *
 * HINWEIS: Die DB hat UNIQUE(team_id, position) – das schließt auch position=0 ein.
 * D.h. bei setRoster darf position 0 nur einmal vorkommen.
 * Diese Validierung wird hier daher auf ALLE Positionen angewendet.
 */
export const setRosterSchema = z
  .array(rosterEntrySchema)
  .refine(
    (entries) =>
      new Set(entries.map((e) => e.position)).size === entries.length,
    { message: 'Alle Positionen im Kader müssen eindeutig sein' },
  )
  .refine((entries) => entries.length <= 20, {
    message: 'Ein Kader darf maximal 20 Spieler enthalten',
  });

// ─── Inferred types ──────────────────────────────────────────────────────────

export type TeamCreateInput = z.infer<typeof teamCreateSchema>;
export type TeamUpdateInput = z.infer<typeof teamUpdateSchema>;
export type TeamFilterInput = z.infer<typeof teamFilterSchema>;
export type TeamAssignmentInput = z.infer<typeof teamAssignmentSchema>;
export type RosterEntry = z.infer<typeof rosterEntrySchema>;
export type SetRosterInput = z.infer<typeof setRosterSchema>;

// Rückwärtskompatibel – war bisher teamMemberCreateSchema
export { teamAssignmentSchema as teamMemberCreateSchema };
export type { TeamAssignmentInput as TeamMemberCreateInput };
