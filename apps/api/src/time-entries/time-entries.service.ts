import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import { QboSyncService } from "../quickbooks/qbo-sync.service";
import type {
  TimeEntry,
  TimeEntryWithUser,
  TimeEntryWithDetails,
  CreateTimeEntryDto,
  UpdateTimeEntryDto,
} from "@interface/shared";

@Injectable()
export class TimeEntriesService {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly qboSync: QboSyncService,
  ) {}

  async findRecent(
    opts: { limit?: number; startDate?: string; endDate?: string } = {},
  ): Promise<TimeEntryWithDetails[]> {
    const { limit = 50, startDate, endDate } = opts;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (startDate) {
      params.push(startDate);
      conditions.push(`t.date >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`t.date <= $${params.length}`);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Only apply row limit when no date range is specified
    const limitClause =
      !startDate && !endDate
        ? `LIMIT $${params.push(limit) && params.length}`
        : "";

    const { rows } = await this.pool.query(
      `SELECT t.id, t.project_id AS "projectId", t.user_id AS "userId",
              t.task_id AS "taskId",
              t.date, t.hours,
              t.description, t.billable,
              t.qbo_time_activity_id AS "qboTimeActivityId",
              t.created_at AS "createdAt", t.updated_at AS "updatedAt",
              json_build_object('id', u.id, 'name', u.name) AS user,
              json_build_object('id', p.id, 'name', p.name) AS project,
              CASE WHEN tk.id IS NOT NULL THEN json_build_object('id', tk.id, 'name', tk.name) ELSE NULL END AS task
       FROM time_entries t
       JOIN users u ON u.id = t.user_id
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN tasks tk ON tk.id = t.task_id
       ${where}
       ORDER BY t.date DESC, t.created_at DESC
       ${limitClause}`,
      params,
    );
    return rows;
  }

  async findByProject(projectId: string): Promise<TimeEntryWithUser[]> {
    const { rows } = await this.pool.query(
      `SELECT t.id, t.project_id AS "projectId", t.user_id AS "userId",
              t.task_id AS "taskId",
              t.date, t.hours,
              t.description, t.billable,
              t.qbo_time_activity_id AS "qboTimeActivityId",
              t.created_at AS "createdAt", t.updated_at AS "updatedAt",
              json_build_object('id', u.id, 'name', u.name) AS user,
              CASE WHEN tk.id IS NOT NULL THEN json_build_object('id', tk.id, 'name', tk.name) ELSE NULL END AS task
       FROM time_entries t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN tasks tk ON tk.id = t.task_id
       WHERE t.project_id = $1 ORDER BY t.date DESC`,
      [projectId],
    );
    return rows;
  }

  async findById(id: string): Promise<TimeEntry> {
    const { rows } = await this.pool.query(
      `SELECT id, project_id AS "projectId", user_id AS "userId",
              task_id AS "taskId",
              date, hours,
              description, billable,
              qbo_time_activity_id AS "qboTimeActivityId",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM time_entries WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Time entry not found");
    return rows[0];
  }

  async create(dto: CreateTimeEntryDto): Promise<TimeEntry> {
    const id = uuid();
    const { rows } = await this.pool.query(
      `INSERT INTO time_entries (id, project_id, user_id, task_id, date, hours, description, billable)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, project_id AS "projectId", user_id AS "userId",
                 task_id AS "taskId",
                 date, hours,
                 description, billable,
                 qbo_time_activity_id AS "qboTimeActivityId",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.projectId,
        dto.userId,
        dto.taskId ?? null,
        dto.date,
        dto.hours,
        dto.description ?? null,
        dto.billable ?? true,
      ],
    );
    // Fire-and-forget QBO sync
    this.qboSync.syncTimeEntryCreate(id);
    return rows[0];
  }

  async update(id: string, dto: UpdateTimeEntryDto): Promise<TimeEntry> {
    const existing = await this.findById(id);
    const { rows } = await this.pool.query(
      `UPDATE time_entries SET project_id = $2, user_id = $3, task_id = $4,
              date = $5, hours = $6, description = $7, billable = $8, updated_at = NOW()
       WHERE id = $1
       RETURNING id, project_id AS "projectId", user_id AS "userId",
                 task_id AS "taskId",
                 date, hours,
                 description, billable,
                 qbo_time_activity_id AS "qboTimeActivityId",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.projectId ?? existing.projectId,
        dto.userId ?? existing.userId,
        dto.taskId !== undefined ? dto.taskId : existing.taskId,
        dto.date ?? existing.date,
        dto.hours ?? existing.hours,
        dto.description ?? existing.description,
        dto.billable ?? existing.billable,
      ],
    );
    // Fire-and-forget QBO sync
    this.qboSync.syncTimeEntryUpdate(id);
    return rows[0];
  }

  async remove(id: string): Promise<void> {
    // Sync delete before removing the row (need qbo_time_activity_id)
    await this.qboSync.syncTimeEntryDelete(id);
    const result = await this.pool.query(
      "DELETE FROM time_entries WHERE id = $1",
      [id],
    );
    if (result.rowCount === 0)
      throw new NotFoundException("Time entry not found");
  }
}
