import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import type {
  Milestone,
  CreateMilestoneDto,
  UpdateMilestoneDto,
} from "@interface/shared";

@Injectable()
export class MilestonesService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findByProject(projectId: string): Promise<Milestone[]> {
    const { rows } = await this.pool.query(
      `SELECT id, project_id AS "projectId", name, completed,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM milestones WHERE project_id = $1 ORDER BY created_at`,
      [projectId],
    );
    return rows;
  }

  async findById(id: string): Promise<Milestone> {
    const { rows } = await this.pool.query(
      `SELECT id, project_id AS "projectId", name, completed,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM milestones WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Milestone not found");
    return rows[0];
  }

  async create(dto: CreateMilestoneDto): Promise<Milestone> {
    const id = uuid();
    const { rows } = await this.pool.query(
      `INSERT INTO milestones (id, project_id, name)
       VALUES ($1, $2, $3)
       RETURNING id, project_id AS "projectId", name, completed,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, dto.projectId, dto.name],
    );
    return rows[0];
  }

  async update(id: string, dto: UpdateMilestoneDto): Promise<Milestone> {
    const existing = await this.findById(id);
    const { rows } = await this.pool.query(
      `UPDATE milestones SET name = $2, completed = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING id, project_id AS "projectId", name, completed,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.name ?? existing.name,
        dto.completed !== undefined ? dto.completed : existing.completed,
      ],
    );
    return rows[0];
  }

  async remove(id: string): Promise<void> {
    const result = await this.pool.query(
      "DELETE FROM milestones WHERE id = $1",
      [id],
    );
    if (result.rowCount === 0)
      throw new NotFoundException("Milestone not found");
  }
}
