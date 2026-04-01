import { z } from 'zod';

export const newsCreateSchema = z.object({
  title: z.string().min(1, 'Titel ist erforderlich').max(300),
  content: z.string().min(1, 'Inhalt ist erforderlich'),
  is_published: z.boolean().default(false),
  image_url: z.string().url().nullable().optional(),
  author_id: z.string().uuid(),
});

export const newsUpdateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.string().optional(),
  is_published: z.boolean().optional(),
  image_url: z.string().url().nullable().optional(),
});

export type NewsCreateInput = z.infer<typeof newsCreateSchema>;
export type NewsUpdateInput = z.infer<typeof newsUpdateSchema>;
