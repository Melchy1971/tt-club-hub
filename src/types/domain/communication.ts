export type CommunicationAudience = 'public' | 'internal' | 'all';

export type PublicationStatus = 'draft' | 'published' | 'all';

export interface CommunicationPagination {
  limit?: number;
  offset?: number;
}

export interface CommunicationExportMeta {
  generatedAt: string;
  generatedBy?: string;
  audience: Exclude<CommunicationAudience, 'all'>;
}
