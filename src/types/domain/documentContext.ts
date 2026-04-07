export type DocumentOwnerContext = 'communication' | 'board_meeting' | 'board_general' | 'public';

export type DocumentVisibility = 'public' | 'internal';

export interface DocumentMetadata {
  id: string;
  title: string;
  description: string | null;
  ownerContext: DocumentOwnerContext;
  ownerId: string | null;
  visibility: DocumentVisibility;
  category: string | null;
  storageBucket: string;
  storagePath: string | null;
  fileUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  uploaderId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentUploadInput {
  title: string;
  description?: string;
  ownerContext: DocumentOwnerContext;
  ownerId?: string;
  visibility: DocumentVisibility;
  category?: string;
  uploaderId: string;
}

export interface DocumentQueryFilter {
  ownerContext?: DocumentOwnerContext;
  ownerId?: string;
  visibility?: DocumentVisibility;
  category?: string;
  search?: string;
  mimeTypePrefix?: string;
  limit?: number;
  offset?: number;
}
