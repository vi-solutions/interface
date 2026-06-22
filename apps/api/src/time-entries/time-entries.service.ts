import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import type {
  TimeEntry,
  TimeEntryWithUser,
  TimeEntryWithDetails,
  TimeEntryReportEntry,
  CreateTimeEntryDto,
  UpdateTimeEntryDto,
} from "@interface/shared";

@Injectable()
export class TimeEntriesService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  private readonly lockedSelect = `
              EXISTS (
                SELECT 1 FROM invoices i
                WHERE i.project_id = t.project_id
                  AND i.period_start <= t.date
                  AND i.period_end >= t.date
                  AND i.status IN ('sent', 'paid')
              )
              OR EXISTS (
                SELECT 1 FROM pay_period_locks ppl
                WHERE ppl.period_start <= t.date
                  AND ppl.period_end >= t.date
              ) AS locked`;

  private roundUpToIncrement(hours: number, increment: number): number {
    if (hours <= 0) return 0;
    return Math.ceil((hours - Number.EPSILON) / increment) * increment;
  }

  async findRecent(
    opts: {
      limit?: number;
      startDate?: string;
      endDate?: string;
      userId?: string;
      roundUpIncrementHours?: number;
    } = {},
  ): Promise<TimeEntryWithDetails[]> {
    const {
      limit = 50,
      startDate,
      endDate,
      userId,
      roundUpIncrementHours,
    } = opts;
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
    if (userId) {
      params.push(userId);
      conditions.push(`t.user_id = $${params.length}`);
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
              ${this.lockedSelect},
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
    if (!roundUpIncrementHours || roundUpIncrementHours <= 0) return rows;

    return rows.map((row) => ({
      ...row,
      hours: this.roundUpToIncrement(Number(row.hours), roundUpIncrementHours),
    }));
  }

  async findByProject(projectId: string): Promise<TimeEntryWithUser[]> {
    const { rows } = await this.pool.query(
      `SELECT t.id, t.project_id AS "projectId", t.user_id AS "userId",
              t.task_id AS "taskId",
              t.date, t.hours,
              t.description, t.billable,
              ${this.lockedSelect},
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
              EXISTS (
                SELECT 1 FROM invoices i
                WHERE i.project_id = time_entries.project_id
                  AND i.period_start <= time_entries.date
                  AND i.period_end >= time_entries.date
                  AND i.status IN ('sent', 'paid')
              )
              OR EXISTS (
                SELECT 1 FROM pay_period_locks ppl
                WHERE ppl.period_start <= time_entries.date
                  AND ppl.period_end >= time_entries.date
              ) AS locked,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM time_entries WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Time entry not found");
    return rows[0];
  }

  private async assertNotLocked(
    projectId: string,
    date: string,
    opts: { allowLocked?: boolean } = {},
  ): Promise<void> {
    if (opts.allowLocked) return;

    const { rows: invoiceRows } = await this.pool.query(
      `SELECT id FROM invoices
       WHERE project_id = $1
         AND period_start <= $2
         AND period_end >= $2
         AND status IN ('sent', 'paid')
       LIMIT 1`,
      [projectId, date],
    );
    if (invoiceRows[0]) {
      throw new ConflictException(
        "This entry falls within a locked (sent/paid) invoice period and cannot be modified.",
      );
    }

    const { rows: payPeriodRows } = await this.pool.query(
      `SELECT id FROM pay_period_locks
       WHERE period_start <= $1
         AND period_end >= $1
       LIMIT 1`,
      [date],
    );
    if (payPeriodRows[0]) {
      throw new ConflictException(
        "This entry falls within a locked pay period and cannot be modified.",
      );
    }
  }

  async create(
    dto: CreateTimeEntryDto,
    opts: { allowLocked?: boolean } = {},
  ): Promise<TimeEntry> {
    await this.assertNotLocked(dto.projectId, dto.date, opts);
    const id = uuid();
    const { rows } = await this.pool.query(
      `INSERT INTO time_entries (id, project_id, user_id, task_id, date, hours, description, billable)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, project_id AS "projectId", user_id AS "userId",
                 task_id AS "taskId",
                 date, hours,
                 description, billable,
                 false AS locked,
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
    return rows[0];
  }

  async update(
    id: string,
    dto: UpdateTimeEntryDto,
    opts: { allowLocked?: boolean } = {},
  ): Promise<TimeEntry> {
    const existing = await this.findById(id);
    await this.assertNotLocked(existing.projectId, existing.date, opts);
    const newProjectId = dto.projectId ?? existing.projectId;
    const newUserId = dto.userId ?? existing.userId;
    const newDate = dto.date ?? existing.date;
    if (
      newProjectId !== existing.projectId ||
      newUserId !== existing.userId ||
      newDate !== existing.date
    ) {
      await this.assertNotLocked(newProjectId, newDate, opts);
    }
    const { rows } = await this.pool.query(
      `UPDATE time_entries SET project_id = $2, user_id = $3, task_id = $4,
              date = $5, hours = $6, description = $7, billable = $8, updated_at = NOW()
       WHERE id = $1
       RETURNING id, project_id AS "projectId", user_id AS "userId",
                 task_id AS "taskId",
                 date, hours,
                 description, billable,
                 false AS locked,
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
    return rows[0];
  }

  async remove(
    id: string,
    opts: { allowLocked?: boolean } = {},
  ): Promise<void> {
    const entry = await this.findById(id);
    await this.assertNotLocked(entry.projectId, entry.date, opts);
    const result = await this.pool.query(
      "DELETE FROM time_entries WHERE id = $1",
      [id],
    );
    if (result.rowCount === 0)
      throw new NotFoundException("Time entry not found");
  }

  async findReport(opts: {
    startDate: string;
    endDate: string;
    userId?: string;
    clientId?: string;
    projectId?: string;
  }): Promise<TimeEntryReportEntry[]> {
    const params: unknown[] = [opts.startDate, opts.endDate];
    const conditions: string[] = ["t.date >= $1", "t.date <= $2"];

    if (opts.userId) {
      params.push(opts.userId);
      conditions.push(`t.user_id = $${params.length}`);
    }
    if (opts.clientId) {
      params.push(opts.clientId);
      conditions.push(`c.id = $${params.length}`);
    }
    if (opts.projectId) {
      params.push(opts.projectId);
      conditions.push(`t.project_id = $${params.length}`);
    }

    const { rows } = await this.pool.query(
      `SELECT t.id, t.project_id AS "projectId", t.user_id AS "userId",
              t.task_id AS "taskId",
              t.date, t.hours,
              t.description, t.billable,
              ${this.lockedSelect},
              t.created_at AS "createdAt", t.updated_at AS "updatedAt",
              json_build_object('id', u.id, 'name', u.name) AS user,
              json_build_object('id', p.id, 'name', p.name) AS project,
              json_build_object('id', c.id, 'name', c.name) AS client,
              CASE WHEN tk.id IS NOT NULL
                   THEN json_build_object('id', tk.id, 'name', tk.name)
                   ELSE NULL END AS task
       FROM time_entries t
       JOIN users u ON u.id = t.user_id
       JOIN projects p ON p.id = t.project_id
       JOIN clients c ON c.id = p.client_id
       LEFT JOIN tasks tk ON tk.id = t.task_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY t.date DESC, c.name ASC, p.name ASC, t.created_at DESC`,
      params,
    );
    return rows.map((row) => ({
      ...row,
      hours: this.roundUpToIncrement(Number(row.hours), 0.5),
    }));
  }
}
