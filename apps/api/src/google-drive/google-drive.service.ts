import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { Pool } from "pg";
import { DATABASE_POOL } from "../db/database.module";
import type { GoogleDriveConnection } from "@interface/shared";

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

const SCOPES = ["https://www.googleapis.com/auth/drive"];

/** The subfolder names used inside each project folder */
export const PROJECT_SUBFOLDERS = [
  "Project Management",
  "Correspondence",
  "Reference Documents",
  "Reporting",
  "Data",
  "Mapping",
] as const;

export type ProjectSubfolder = (typeof PROJECT_SUBFOLDERS)[number];

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);

  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  /* ------------------------------------------------------------------ */
  /*  OAuth helpers                                                      */
  /* ------------------------------------------------------------------ */

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `${GOOGLE_AUTH_BASE}?${params}`;
  }

  async exchangeCode(code: string): Promise<GoogleDriveConnection> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    });

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    if (!data.access_token) {
      this.logger.error("Google token exchange failed", data);
      throw new BadRequestException("Failed to connect Google Drive");
    }

    const expiresAt = new Date(
      Date.now() + data.expires_in * 1000,
    ).toISOString();

    // Upsert single-row connection
    await this.pool.query("DELETE FROM google_drive_connection");
    const { rows } = await this.pool.query(
      `INSERT INTO google_drive_connection (access_token, refresh_token, access_token_expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, root_folder_id AS "rootFolderId",
                 access_token_expires_at AS "accessTokenExpiresAt",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [data.access_token, data.refresh_token, expiresAt],
    );
    return rows[0];
  }

  async getConnection(): Promise<GoogleDriveConnection | null> {
    const { rows } = await this.pool.query(
      `SELECT id, root_folder_id AS "rootFolderId",
              access_token_expires_at AS "accessTokenExpiresAt",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM google_drive_connection LIMIT 1`,
    );
    return rows[0] ?? null;
  }

  async disconnect(): Promise<void> {
    await this.pool.query("DELETE FROM google_drive_connection");
  }

  /* ------------------------------------------------------------------ */
  /*  Token management (private)                                         */
  /* ------------------------------------------------------------------ */

  private async getAccessToken(): Promise<string> {
    const { rows } = await this.pool.query(
      "SELECT access_token, refresh_token, access_token_expires_at FROM google_drive_connection LIMIT 1",
    );
    const conn = rows[0];
    if (!conn) throw new BadRequestException("Google Drive not connected");

    // Refresh if expired or expiring within 60s
    if (
      new Date(conn.access_token_expires_at) <= new Date(Date.now() + 60000)
    ) {
      return this.refreshAccessToken(conn.refresh_token);
    }
    return conn.access_token;
  }

  private async refreshAccessToken(refreshToken: string): Promise<string> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    });

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };
    if (!data.access_token) {
      this.logger.error("Google token refresh failed", data);
      throw new BadRequestException("Failed to refresh Google Drive token");
    }

    const expiresAt = new Date(
      Date.now() + data.expires_in * 1000,
    ).toISOString();

    await this.pool.query(
      `UPDATE google_drive_connection
       SET access_token = $1,
           refresh_token = COALESCE($2, refresh_token),
           access_token_expires_at = $3,
           updated_at = NOW()`,
      [data.access_token, data.refresh_token ?? null, expiresAt],
    );

    return data.access_token;
  }

  /* ------------------------------------------------------------------ */
  /*  Drive API helpers                                                  */
  /* ------------------------------------------------------------------ */

  private async driveGet<T>(path: string): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`${DRIVE_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Drive GET ${path} failed: ${body}`);
      throw new BadRequestException("Google Drive API request failed");
    }
    return res.json() as Promise<T>;
  }

  private async drivePost<T>(
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`${DRIVE_API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Drive POST ${path} failed: ${text}`);
      throw new BadRequestException("Google Drive API request failed");
    }
    return res.json() as Promise<T>;
  }

  /* ------------------------------------------------------------------ */
  /*  Root folder                                                        */
  /* ------------------------------------------------------------------ */

  /** Set the root folder that all project folders live under */
  async setRootFolder(folderId: string): Promise<void> {
    await this.pool.query(
      "UPDATE google_drive_connection SET root_folder_id = $1, updated_at = NOW()",
      [folderId],
    );
  }

  async getRootFolderId(): Promise<string | null> {
    const { rows } = await this.pool.query(
      "SELECT root_folder_id FROM google_drive_connection LIMIT 1",
    );
    return rows[0]?.root_folder_id ?? null;
  }

  /* ------------------------------------------------------------------ */
  /*  Folder operations                                                  */
  /* ------------------------------------------------------------------ */

  /** Create a folder in Drive, returns the folder ID */
  async createFolder(name: string, parentId?: string): Promise<string> {
    const metadata: Record<string, unknown> = {
      name,
      mimeType: "application/vnd.google-apps.folder",
    };
    if (parentId) metadata.parents = [parentId];

    const result = await this.drivePost<{ id: string }>("/files", metadata);
    return result.id;
  }

  /**
   * Ensure the full project folder structure exists in Drive.
   * Creates: [code] - [projectName] / each subfolder
   * Returns the project root folder ID.
   */
  async ensureProjectFolders(
    projectId: string,
    projectCode: string,
    projectName: string,
  ): Promise<string> {
    // Check if project already has a Drive folder
    const { rows } = await this.pool.query(
      "SELECT google_drive_folder_id FROM projects WHERE id = $1",
      [projectId],
    );
    if (rows[0]?.google_drive_folder_id) {
      return rows[0].google_drive_folder_id;
    }

    const rootId = await this.getRootFolderId();
    const folderName = `${projectCode} - ${projectName}`;
    const projectFolderId = await this.createFolder(
      folderName,
      rootId ?? undefined,
    );

    // Create all subfolders
    for (const sub of PROJECT_SUBFOLDERS) {
      await this.createFolder(sub, projectFolderId);
    }

    // Store folder ID on the project
    await this.pool.query(
      "UPDATE projects SET google_drive_folder_id = $1 WHERE id = $2",
      [projectFolderId, projectId],
    );

    return projectFolderId;
  }

  /** Find the subfolder ID for a given category within a project folder */
  async getSubfolderId(
    projectFolderId: string,
    category: string,
  ): Promise<string> {
    const token = await this.getAccessToken();
    const query = `'${projectFolderId}' in parents and name = '${category.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const res = await fetch(
      `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );
    const data = (await res.json()) as { files: Array<{ id: string }> };
    if (data.files.length > 0) return data.files[0].id;

    // Create if missing
    return this.createFolder(category, projectFolderId);
  }

  /* ------------------------------------------------------------------ */
  /*  File upload                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Upload a file to Drive using multipart upload.
   * Returns { fileId, webViewLink }
   */
  async uploadFile(params: {
    fileName: string;
    mimeType: string;
    buffer: Buffer;
    parentFolderId: string;
  }): Promise<{ fileId: string; webViewLink: string }> {
    const token = await this.getAccessToken();

    const metadata = JSON.stringify({
      name: params.fileName,
      parents: [params.parentFolderId],
    });

    const boundary = "---boundary" + Date.now();
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${params.mimeType}\r\n\r\n`,
      ),
      params.buffer,
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const res = await fetch(
      `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,webViewLink`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Drive upload failed: ${text}`);
      throw new BadRequestException("Failed to upload file to Google Drive");
    }

    const data = (await res.json()) as {
      id: string;
      webViewLink: string;
    };
    return { fileId: data.id, webViewLink: data.webViewLink };
  }

  /** Delete a file from Drive */
  async deleteFile(fileId: string): Promise<void> {
    const token = await this.getAccessToken();
    const res = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404) {
      this.logger.error(`Drive delete failed for ${fileId}`);
    }
  }

  /** List folders in a parent folder (for root folder picker) */
  async listFolders(
    parentId?: string,
  ): Promise<Array<{ id: string; name: string }>> {
    let query =
      "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    } else {
      query += " and 'root' in parents";
    }

    const result = await this.driveGet<{
      files: Array<{ id: string; name: string }>;
    }>(
      `/files?q=${encodeURIComponent(query)}&fields=files(id,name)&orderBy=name&pageSize=100`,
    );
    return result.files;
  }
}
