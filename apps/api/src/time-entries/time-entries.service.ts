import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import type {
  TimeEntry,
  TimeEntryWithUser,
  TimeEntryWithDetails,
  CreateTimeEntryDto,
  UpdateTimeEntryDto,
} from "@interface/shared";

@Injectable()
export class TimeEntriesService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findRecent(limit = 50): Promise<TimeEntryWithDetails[]> {
    const { rows } = await this.pool.query(
      `SELECT t.id, t.project_id AS "projectId", t.user_id AS "userId", t.date, t.hours,
              t.description, t.billable, t.created_at AS "createdAt", t.updated_at AS "updatedAt",
              json_build_object('id', u.id, 'name', u.name) AS user,
              json_build_object('id', p.id, 'name', p.name) AS project
       FROM time_entries t
       JOIN users u ON u.id = t.user_id
       JOIN projects p ON p.id = t.project_id
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT $1`,
      [limit],
    );
    return rows;
  }

  async findByProject(projectId: string): Promise<TimeEntryWithUser[]> {
    const { rows } = await this.pool.query(
      `SELECT t.id, t.project_id AS "projectId", t.user_id AS "userId", t.date, t.hours,
              t.description, t.billable, t.created_at AS "createdAt", t.updated_at AS "updatedAt",
              json_build_object('id', u.id, 'name', u.name) AS user
       FROM time_entries t
       JOIN users u ON u.id = t.user_id
       WHERE t.project_id = $1 ORDER BY t.date DESC`,
      [projectId],
    );
    return rows;
  }

  async findById(id: string): Promise<TimeEntry> {
    const { rows } = await this.pool.query(
      `SELECT id, project_id AS "projectId", user_id AS "userId", date, hours,
              description, billable, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM time_entries WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Time entry not found");
    return rows[0];
  }

  async create(dto: CreateTimeEntryDto): Promise<TimeEntry> {
    const id = uuid();
    const { rows } = await this.pool.query(
      `INSERT INTO time_entries (id, project_id, user_id, date, hours, description, billable)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, project_id AS "projectId", user_id AS "userId", date, hours,
                 description, billable, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.projectId,
        dto.userId,
        dto.date,
        dto.hours,
        dto.description ?? null,
        dto.billable ?? true,
      ],
    );
    return rows[0];
  }

  async update(id: string, dto: UpdateTimeEntryDto): Promise<TimeEntry> {
    const existing = await this.findById(id);
    const { rows } = await this.pool.query(
      `UPDATE time_entries SET project_id = $2, user_id = $3, date = $4, hours = $5,
              description = $6, billable = $7, updated_at = NOW()
       WHERE id = $1
       RETURNING id, project_id AS "projectId", user_id AS "userId", date, hours,
                 description, billable, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.projectId ?? existing.projectId,
        dto.userId ?? existing.userId,
        dto.date ?? existing.date,
        dto.hours ?? existing.hours,
        dto.description ?? existing.description,
        dto.billable ?? existing.billable,
      ],
    );
    return rows[0];
  }

  async remove(id: string): Promise<void> {
    const result = await this.pool.query(
      "DELETE FROM time_entries WHERE id = $1",
      [id],
    );
    if (result.rowCount === 0)
      throw new NotFoundException("Time entry not found");
  }
}
