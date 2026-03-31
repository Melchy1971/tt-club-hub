import { z } from 'zod';

// ── Enum-Schemas ──────────────────────────────────────────────

export const newsStatusSchema = z.enum(['draft', 'published', 'archived']);
export const newsVisibilitySchema = z.enum(['public', 'internal']);

// ── Slug-Hilfsfunktion ────────────────────────────────────────

/** Konvertiert einen beliebigen String in einen URL-sicheren Slug. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // Diakritika entfernen (ä→a)
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-');
}

const slugField = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9-]+$/, 'Slug darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten');

// ── Create ────────────────────────────────────────────────────

export const newsCreateSchema = z
  .object({
    title:      z.string().min(1, 'Titel ist erforderlich').max(300),
    slug:       slugField.optional(),
    content:    z.string().optional(),
    excerpt:    z.string().max(500).optional(),
    status:     newsStatusSchema.default('draft'),
    visibility: newsVisibilitySchema.default('public'),
    author_id:  z.string().uuid().optional(),
    category:   z.string().max(100).optional(),
    tags:       z.array(z.string().max(50)).default([]),
    pinned:     z.boolean().default(false),
    image_url:  z.string().url().optional(),
  })
  .transform((data) => ({
    ...data,
    // Slug aus Titel generieren wenn nicht angegeben
    slug: data.slug ?? slugify(data.title),
  }));

export type NewsCreateInput = z.infer<typeof newsCreateSchema>;

// ── Update ────────────────────────────────────────────────────

export const newsUpdateSchema = z.object({
  title:      z.string().min(1).max(300).optional(),
  slug:       slugField.optional(),
  content:    z.string().optional(),
  excerpt:    z.string().max(500).optional(),
  visibility: newsVisibilitySchema.optional(),
  author_id:  z.string().uuid().nullable().optional(),
  category:   z.string().max(100).nullable().optional(),
  tags:       z.array(z.string().max(50)).optional(),
  pinned:     z.boolean().optional(),
  image_url:  z.string().url().nullable().optional(),
});

export type NewsUpdateInput = z.infer<typeof newsUpdateSchema>;

// ── Filter ────────────────────────────────────────────────────

export const newsFilterSchema = z.object({
  status:      newsStatusSchema.optional(),
  visibility:  newsVisibilitySchema.optional(),
  category:    z.string().optional(),
  authorId:    z.string().uuid().optional(),
  search:      z.string().max(200).optional(),
  pinnedFirst: z.boolean().default(true),
  limit:       z.number().int().min(1).max(100).default(20),
  offset:      z.number().int().min(0).default(0),
});

export type NewsFilterInput = z.infer<typeof newsFilterSchema>;
