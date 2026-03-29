import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import { GoogleDriveService } from "../google-drive/google-drive.service";
import type {
  Document,
  DocumentWithDetails,
  CreateDocumentDto,
  UpdateDocumentDto,
} from "@interface/shared";

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly drive: GoogleDriveService,
  ) {}

  async findByProject(projectId: string): Promise<DocumentWithDetails[]> {
    const { rows } = await this.pool.query(
      `SELECT d.id, d.project_id AS "projectId", d.name,
              d.google_drive_file_id AS "googleDriveFileId",
              d.google_drive_url AS "googleDriveUrl",
              d.mime_type AS "mimeType", d.size_bytes AS "sizeBytes",
              d.category, d.uploaded_by AS "uploadedBy", d.created_at AS "createdAt",
              u.name AS "uploadedByName", p.name AS "projectName"
       FROM documents d
       JOIN users u ON u.id = d.uploaded_by
       JOIN projects p ON p.id = d.project_id
       WHERE d.project_id = $1
       ORDER BY d.created_at DESC`,
      [projectId],
    );
    return rows;
  }

  async findRecent(): Promise<DocumentWithDetails[]> {
    const { rows } = await this.pool.query(
      `SELECT d.id, d.project_id AS "projectId", d.name,
              d.google_drive_file_id AS "googleDriveFileId",
              d.google_drive_url AS "googleDriveUrl",
              d.mime_type AS "mimeType", d.size_bytes AS "sizeBytes",
              d.category, d.uploaded_by AS "uploadedBy", d.created_at AS "createdAt",
              u.name AS "uploadedByName", p.name AS "projectName"
       FROM documents d
       JOIN users u ON u.id = d.uploaded_by
       JOIN projects p ON p.id = d.project_id
       ORDER BY d.created_at DESC
       LIMIT 100`,
    );
    return rows;
  }

  async findById(id: string): Promise<Document> {
    const { rows } = await this.pool.query(
      `SELECT id, project_id AS "projectId", name,
              google_drive_file_id AS "googleDriveFileId",
              google_drive_url AS "googleDriveUrl",
              mime_type AS "mimeType", size_bytes AS "sizeBytes",
              category, uploaded_by AS "uploadedBy", created_at AS "createdAt"
       FROM documents WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Document not found");
    return rows[0];
  }

  async getProjectForUpload(
    projectId: string,
  ): Promise<{ code: string | null; name: string }> {
    const { rows } = await this.pool.query(
      "SELECT code, name FROM projects WHERE id = $1",
      [projectId],
    );
    if (!rows[0]) throw new NotFoundException("Project not found");
    return rows[0];
  }

  async create(dto: CreateDocumentDto, userId: string): Promise<Document> {
    const id = uuid();
    const fileId =
      dto.googleDriveFileId ??
      this.extractGoogleDriveFileId(dto.googleDriveUrl ?? "");
    const { rows } = await this.pool.query(
      `INSERT INTO documents (id, project_id, name, google_drive_url, google_drive_file_id, mime_type, size_bytes, category, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, project_id AS "projectId", name,
                 google_drive_file_id AS "googleDriveFileId",
                 google_drive_url AS "googleDriveUrl",
                 mime_type AS "mimeType", size_bytes AS "sizeBytes",
                 category, uploaded_by AS "uploadedBy", created_at AS "createdAt"`,
      [
        id,
        dto.projectId,
        dto.name,
        dto.googleDriveUrl ?? null,
        fileId,
        dto.mimeType ?? null,
        dto.sizeBytes ?? null,
        dto.category ?? null,
        userId,
      ],
    );
    return rows[0];
  }

  async update(id: string, dto: UpdateDocumentDto): Promise<Document> {
    const existing = await this.findById(id);
    const url = dto.googleDriveUrl ?? existing.googleDriveUrl;
    const fileId = dto.googleDriveUrl
      ? this.extractGoogleDriveFileId(dto.googleDriveUrl)
      : existing.googleDriveFileId;

    const { rows } = await this.pool.query(
      `UPDATE documents SET name = $2, google_drive_url = $3,
              google_drive_file_id = $4, mime_type = $5
       WHERE id = $1
       RETURNING id, project_id AS "projectId", name,
                 google_drive_file_id AS "googleDriveFileId",
                 google_drive_url AS "googleDriveUrl",
                 mime_type AS "mimeType", size_bytes AS "sizeBytes",
                 uploaded_by AS "uploadedBy", created_at AS "createdAt"`,
      [
        id,
        dto.name ?? existing.name,
        url,
        fileId,
        dto.mimeType ?? existing.mimeType,
      ],
    );
    return rows[0];
  }

  async remove(id: string): Promise<void> {
    // Try to delete from Google Drive too
    const doc = await this.findById(id).catch(() => null);
    if (doc?.googleDriveFileId) {
      try {
        await this.drive.deleteFile(doc.googleDriveFileId);
      } catch {
        // Drive deletion is best-effort
      }
    }
    const result = await this.pool.query(
      "DELETE FROM documents WHERE id = $1",
      [id],
    );
    if (result.rowCount === 0)
      throw new NotFoundException("Document not found");
  }

  private extractGoogleDriveFileId(url: string): string | null {
    // Handle various Google Drive URL formats:
    // https://drive.google.com/file/d/FILE_ID/view
    // https://drive.google.com/open?id=FILE_ID
    // https://docs.google.com/document/d/FILE_ID/edit
    // https://docs.google.com/spreadsheets/d/FILE_ID/edit
    const patterns = [/\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }
}
