import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import type {
  ProjectTimeCategory,
  CreateProjectTimeCategoryDto,
  UpdateProjectTimeCategoryDto,
} from "@interface/shared";

@Injectable()
export class ProjectTimeCategoriesService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findByProject(projectId: string): Promise<ProjectTimeCategory[]> {
    // Auto-create project records for global categories that don't have one yet
    await this.pool.query(
      `INSERT INTO project_time_categories (id, project_id, time_category_id)
       SELECT gen_random_uuid(), $1, tc.id
       FROM time_categories tc
       WHERE tc.archived_at IS NULL
         AND tc.id NOT IN (
           SELECT time_category_id FROM project_time_categories
           WHERE project_id = $1 AND time_category_id IS NOT NULL
         )
       ON CONFLICT (project_id, time_category_id) DO NOTHING`,
      [projectId],
    );

    const { rows } = await this.pool.query(
      `SELECT ptc.id, ptc.project_id AS "projectId",
              ptc.time_category_id AS "timeCategoryId",
              COALESCE(ptc.name, tc.name) AS name,
              COALESCE(ptc.description, tc.description) AS description,
              ptc.created_at AS "createdAt", ptc.updated_at AS "updatedAt"
       FROM project_time_categories ptc
       LEFT JOIN time_categories tc ON tc.id = ptc.time_category_id
       WHERE ptc.project_id = $1
         AND (ptc.time_category_id IS NULL OR tc.archived_at IS NULL)
       ORDER BY COALESCE(ptc.name, tc.name)`,
      [projectId],
    );
    return rows;
  }

  async findById(id: string): Promise<ProjectTimeCategory> {
    const { rows } = await this.pool.query(
      `SELECT ptc.id, ptc.project_id AS "projectId",
              ptc.time_category_id AS "timeCategoryId",
              COALESCE(ptc.name, tc.name) AS name,
              COALESCE(ptc.description, tc.description) AS description,
              ptc.created_at AS "createdAt", ptc.updated_at AS "updatedAt"
       FROM project_time_categories ptc
       LEFT JOIN time_categories tc ON tc.id = ptc.time_category_id
       WHERE ptc.id = $1`,
      [id],
    );
    if (!rows[0])
      throw new NotFoundException("Project time category not found");
    return rows[0];
  }

  async create(
    dto: CreateProjectTimeCategoryDto,
  ): Promise<ProjectTimeCategory> {
    const id = uuid();
    const { rows } = await this.pool.query(
      `INSERT INTO project_time_categories (id, project_id, time_category_id, name, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, project_id AS "projectId",
                 time_category_id AS "timeCategoryId",
                 name, description,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.projectId,
        dto.timeCategoryId ?? null,
        dto.name ?? null,
        dto.description ?? null,
      ],
    );
    return rows[0];
  }

  async update(
    id: string,
    dto: UpdateProjectTimeCategoryDto,
  ): Promise<ProjectTimeCategory> {
    const existing = await this.findById(id);
    const { rows } = await this.pool.query(
      `UPDATE project_time_categories SET name = $2, description = $3,
              updated_at = NOW()
       WHERE id = $1
       RETURNING id, project_id AS "projectId",
                 time_category_id AS "timeCategoryId",
                 name, description,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, dto.name ?? existing.name, dto.description ?? existing.description],
    );
    return rows[0];
  }

  async remove(id: string): Promise<void> {
    const result = await this.pool.query(
      "DELETE FROM project_time_categories WHERE id = $1",
      [id],
    );
    if (result.rowCount === 0)
      throw new NotFoundException("Project time category not found");
  }
}
