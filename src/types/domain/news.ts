/**
 * News-Domain-Typen – passend zur DB-Tabelle `news`
 * Spalten: id, title, content, is_published, published_at, author_id, image_url, created_at, updated_at
 */

import type { CommunicationAudience, CommunicationPagination, PublicationStatus } from './communication';

export interface NewsRow {
  id: string;
  title: string;
  content: string;
  is_published: boolean;
  published_at: string | null;
  author_id: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsCreateDTO {
  title: string;
  content: string;
  is_published?: boolean;
  image_url?: string | null;
  author_id: string;
}

export interface NewsUpdateDTO {
  title?: string;
  content?: string;
  is_published?: boolean;
  image_url?: string | null;
}

export interface NewsFilter extends CommunicationPagination {
  is_published?: boolean;
  status?: PublicationStatus;
  audience?: CommunicationAudience;
  search?: string;
}
