import { z } from 'zod';

export const teamCreateSchema = z.object({
  name: z.string().min(1, 'Mannschaftsname ist erforderlich').max(100),
  league: z.string().min(1, 'Liga ist erforderlich').max(100),
  season_id: z.string().uuid('Ungültige Saison-ID'),
  division: z.string().max(50).nullable().optional(),
  captain_id: z.string().uuid('Ungültige Spielführer-ID').nullable().optional(),
  is_active: z.boolean().default(true),
});

export const teamUpdateSchema = teamCreateSchema.partial();

export const teamFilterSchema = z.object({
  is_active: z.boolean().optional(),
  season_id: z.string().uuid().optional(),
});

export const teamMemberCreateSchema = z.object({
  team_id: z.string().uuid('Ungültige Mannschafts-ID'),
  member_id: z.string().uuid('Ungültige Mitglieds-ID'),
  position: z.number().int().min(1).max(20),
});

export type TeamCreateInput = z.infer<typeof teamCreateSchema>;
export type TeamUpdateInput = z.infer<typeof teamUpdateSchema>;
export type TeamFilterInput = z.infer<typeof teamFilterSchema>;
export type TeamMemberCreateInput = z.infer<typeof teamMemberCreateSchema>;
