export interface Document {
  id: string;
  projectId: string;
  name: string;
  googleDriveFileId: string | null;
  googleDriveUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  category: string | null;
  uploadedBy: string;
  createdAt: string;
}

export interface DocumentWithDetails extends Document {
  uploadedByName: string;
  projectName: string;
}

export interface CreateDocumentDto {
  projectId: string;
  name: string;
  googleDriveUrl?: string;
  googleDriveFileId?: string;
  mimeType?: string;
  sizeBytes?: number;
  category?: string;
}

export interface UpdateDocumentDto {
  name?: string;
  googleDriveUrl?: string;
  mimeType?: string;
}
