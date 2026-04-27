import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import type {
  ProjectNoteWithAuthor,
  CreateProjectNoteDto,
  UpdateProjectNoteDto,
} from "@interface/shared";

@Injectable()
export class ProjectNotesService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findByProject(projectId: string): Promise<ProjectNoteWithAuthor[]> {
    const { rows } = await this.pool.query(
      `SELECT pn.id, pn.project_id AS "projectId", pn.user_id AS "userId",
              pn.content, pn.created_at AS "createdAt", pn.updated_at AS "updatedAt",
              json_build_object('id', u.id, 'name', u.name) AS author
       FROM project_notes pn
       JOIN users u ON u.id = pn.user_id
       WHERE pn.project_id = $1
       ORDER BY pn.created_at DESC`,
      [projectId],
    );
    return rows;
  }

  async create(dto: CreateProjectNoteDto): Promise<ProjectNoteWithAuthor> {
    const id = uuid();
    const { rows } = await this.pool.query(
      `WITH inserted AS (
         INSERT INTO project_notes (id, project_id, user_id, content)
         VALUES ($1, $2, $3, $4)
         RETURNING id, project_id, user_id, content, created_at, updated_at
       )
       SELECT i.id, i.project_id AS "projectId", i.user_id AS "userId",
              i.content, i.created_at AS "createdAt", i.updated_at AS "updatedAt",
              json_build_object('id', u.id, 'name', u.name) AS author
       FROM inserted i
       JOIN users u ON u.id = i.user_id`,
      [id, dto.projectId, dto.userId, dto.content],
    );
    return rows[0];
  }

  async update(
    id: string,
    dto: UpdateProjectNoteDto,
    requestingUserId: string,
  ): Promise<ProjectNoteWithAuthor> {
    const { rows: existing } = await this.pool.query(
      `SELECT user_id FROM project_notes WHERE id = $1`,
      [id],
    );
    if (!existing[0]) throw new NotFoundException("Note not found");
    if (existing[0].user_id !== requestingUserId)
      throw new ForbiddenException("You can only edit your own notes");

    const { rows } = await this.pool.query(
      `WITH updated AS (
         UPDATE project_notes SET content = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING id, project_id, user_id, content, created_at, updated_at
       )
       SELECT u2.id, u2.project_id AS "projectId", u2.user_id AS "userId",
              u2.content, u2.created_at AS "createdAt", u2.updated_at AS "updatedAt",
              json_build_object('id', usr.id, 'name', usr.name) AS author
       FROM updated u2
       JOIN users usr ON usr.id = u2.user_id`,
      [id, dto.content],
    );
    return rows[0];
  }

  async remove(
    id: string,
    requestingUserId: string,
    isAdmin: boolean,
  ): Promise<void> {
    const { rows } = await this.pool.query(
      `SELECT user_id FROM project_notes WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Note not found");
    if (!isAdmin && rows[0].user_id !== requestingUserId)
      throw new ForbiddenException("You can only delete your own notes");

    await this.pool.query(`DELETE FROM project_notes WHERE id = $1`, [id]);
  }
}
