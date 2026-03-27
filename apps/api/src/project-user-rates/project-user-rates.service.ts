import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import type {
  ProjectUserRate,
  ProjectUserRateWithUser,
  CreateProjectUserRateDto,
  UpdateProjectUserRateDto,
} from "@interface/shared";

@Injectable()
export class ProjectUserRatesService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findByProject(projectId: string): Promise<ProjectUserRateWithUser[]> {
    const { rows } = await this.pool.query(
      `SELECT pur.id, pur.project_id AS "projectId",
              pur.user_id AS "userId",
              pur.hourly_rate_cents AS "hourlyRateCents",
              pur.daily_rate_cents AS "dailyRateCents",
              pur.created_at AS "createdAt", pur.updated_at AS "updatedAt",
              json_build_object('id', u.id, 'name', u.name) AS user
       FROM project_user_rates pur
       JOIN users u ON u.id = pur.user_id
       WHERE pur.project_id = $1
       ORDER BY u.name`,
      [projectId],
    );
    return rows;
  }

  async findById(id: string): Promise<ProjectUserRate> {
    const { rows } = await this.pool.query(
      `SELECT id, project_id AS "projectId", user_id AS "userId",
              hourly_rate_cents AS "hourlyRateCents",
              daily_rate_cents AS "dailyRateCents",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM project_user_rates WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Project user rate not found");
    return rows[0];
  }

  async create(dto: CreateProjectUserRateDto): Promise<ProjectUserRate> {
    const id = uuid();
    const { rows } = await this.pool.query(
      `INSERT INTO project_user_rates (id, project_id, user_id, hourly_rate_cents, daily_rate_cents)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (project_id, user_id) DO UPDATE
         SET hourly_rate_cents = EXCLUDED.hourly_rate_cents,
             daily_rate_cents = EXCLUDED.daily_rate_cents,
             updated_at = NOW()
       RETURNING id, project_id AS "projectId", user_id AS "userId",
                 hourly_rate_cents AS "hourlyRateCents",
                 daily_rate_cents AS "dailyRateCents",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.projectId,
        dto.userId,
        dto.hourlyRateCents ?? null,
        dto.dailyRateCents ?? null,
      ],
    );
    return rows[0];
  }

  async update(
    id: string,
    dto: UpdateProjectUserRateDto,
  ): Promise<ProjectUserRate> {
    const sets: string[] = [];
    const values: unknown[] = [id];
    let idx = 2;

    if (dto.hourlyRateCents !== undefined) {
      sets.push(`hourly_rate_cents = $${idx++}`);
      values.push(dto.hourlyRateCents);
    }
    if (dto.dailyRateCents !== undefined) {
      sets.push(`daily_rate_cents = $${idx++}`);
      values.push(dto.dailyRateCents);
    }

    if (sets.length === 0) return this.findById(id);

    sets.push("updated_at = NOW()");
    const { rows } = await this.pool.query(
      `UPDATE project_user_rates
       SET ${sets.join(", ")}
       WHERE id = $1
       RETURNING id, project_id AS "projectId", user_id AS "userId",
                 hourly_rate_cents AS "hourlyRateCents",
                 daily_rate_cents AS "dailyRateCents",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      values,
    );
    if (!rows[0]) throw new NotFoundException("Project user rate not found");
    return rows[0];
  }

  async remove(id: string): Promise<void> {
    const result = await this.pool.query(
      "DELETE FROM project_user_rates WHERE id = $1",
      [id],
    );
    if (result.rowCount === 0)
      throw new NotFoundException("Project user rate not found");
  }
}
