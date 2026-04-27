import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import type {
  ProjectContactWithDetails,
  CreateProjectContactDto,
} from "@interface/shared";

@Injectable()
export class ProjectContactsService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findByProject(projectId: string): Promise<ProjectContactWithDetails[]> {
    const { rows } = await this.pool.query(
      `SELECT pc.id, pc.project_id AS "projectId", pc.contact_id AS "contactId",
              pc.created_at AS "createdAt",
              json_build_object(
                'id', c.id,
                'clientId', c.client_id,
                'name', c.name,
                'email', c.email,
                'phone', c.phone,
                'title', c.title,
                'agency', c.agency,
                'createdAt', c.created_at,
                'updatedAt', c.updated_at
              ) AS contact
       FROM project_contacts pc
       JOIN contacts c ON c.id = pc.contact_id
       WHERE pc.project_id = $1
       ORDER BY c.name`,
      [projectId],
    );
    return rows;
  }

  async create(
    dto: CreateProjectContactDto,
  ): Promise<ProjectContactWithDetails> {
    const id = uuid();
    await this.pool.query(
      `INSERT INTO project_contacts (id, project_id, contact_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, contact_id) DO NOTHING`,
      [id, dto.projectId, dto.contactId],
    );
    // Return the full record with contact details
    const { rows } = await this.pool.query(
      `SELECT pc.id, pc.project_id AS "projectId", pc.contact_id AS "contactId",
              pc.created_at AS "createdAt",
              json_build_object(
                'id', c.id,
                'clientId', c.client_id,
                'name', c.name,
                'email', c.email,
                'phone', c.phone,
                'title', c.title,
                'agency', c.agency,
                'createdAt', c.created_at,
                'updatedAt', c.updated_at
              ) AS contact
       FROM project_contacts pc
       JOIN contacts c ON c.id = pc.contact_id
       WHERE pc.project_id = $1 AND pc.contact_id = $2`,
      [dto.projectId, dto.contactId],
    );
    return rows[0];
  }

  async remove(id: string): Promise<void> {
    const result = await this.pool.query(
      "DELETE FROM project_contacts WHERE id = $1",
      [id],
    );
    if (result.rowCount === 0)
      throw new NotFoundException("Project contact not found");
  }
}
