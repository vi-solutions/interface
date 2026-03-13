export interface Document {
  id: string;
  projectId: string;
  name: string;
  fileKey: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}

export interface CreateDocumentDto {
  projectId: string;
  name: string;
  fileKey: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
}
