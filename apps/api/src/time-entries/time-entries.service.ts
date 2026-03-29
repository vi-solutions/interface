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

  async findRecent(limit = 50): Promise<TimeEntryWithDetails[]> {
    const { rows } = await this.pool.query(
      `SELECT t.id, t.project_id AS "projectId", t.user_id AS "userId",
              t.milestone_id AS "milestoneId",
              t.project_time_category_id AS "projectTimeCategoryId",
              t.date, t.hours,
              t.description, t.billable,
              t.qbo_time_activity_id AS "qboTimeActivityId",
              t.created_at AS "createdAt", t.updated_at AS "updatedAt",
              json_build_object('id', u.id, 'name', u.name) AS user,
              json_build_object('id', p.id, 'name', p.name) AS project,
              CASE WHEN m.id IS NOT NULL THEN json_build_object('id', m.id, 'name', m.name) ELSE NULL END AS milestone,
              CASE WHEN ptc.id IS NOT NULL THEN json_build_object('id', ptc.id, 'name', COALESCE(ptc.name, tc.name)) ELSE NULL END AS "timeCategory"
       FROM time_entries t
       JOIN users u ON u.id = t.user_id
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN milestones m ON m.id = t.milestone_id
       LEFT JOIN project_time_categories ptc ON ptc.id = t.project_time_category_id
       LEFT JOIN time_categories tc ON tc.id = ptc.time_category_id
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT $1`,
      [limit],
    );
    return rows;
  }

  async findByProject(projectId: string): Promise<TimeEntryWithUser[]> {
    const { rows } = await this.pool.query(
      `SELECT t.id, t.project_id AS "projectId", t.user_id AS "userId",
              t.milestone_id AS "milestoneId",
              t.project_time_category_id AS "projectTimeCategoryId",
              t.date, t.hours,
              t.description, t.billable,
              t.qbo_time_activity_id AS "qboTimeActivityId",
              t.created_at AS "createdAt", t.updated_at AS "updatedAt",
              json_build_object('id', u.id, 'name', u.name) AS user,
              CASE WHEN m.id IS NOT NULL THEN json_build_object('id', m.id, 'name', m.name) ELSE NULL END AS milestone,
              CASE WHEN ptc.id IS NOT NULL THEN json_build_object('id', ptc.id, 'name', COALESCE(ptc.name, tc.name)) ELSE NULL END AS "timeCategory"
       FROM time_entries t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN milestones m ON m.id = t.milestone_id
       LEFT JOIN project_time_categories ptc ON ptc.id = t.project_time_category_id
       LEFT JOIN time_categories tc ON tc.id = ptc.time_category_id
       WHERE t.project_id = $1 ORDER BY t.date DESC`,
      [projectId],
    );
    return rows;
  }

  async findById(id: string): Promise<TimeEntry> {
    const { rows } = await this.pool.query(
      `SELECT id, project_id AS "projectId", user_id AS "userId",
              milestone_id AS "milestoneId",
              project_time_category_id AS "projectTimeCategoryId",
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
      `INSERT INTO time_entries (id, project_id, user_id, milestone_id, project_time_category_id, date, hours, description, billable)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, project_id AS "projectId", user_id AS "userId",
                 milestone_id AS "milestoneId",
                 project_time_category_id AS "projectTimeCategoryId",
                 date, hours,
                 description, billable,
                 qbo_time_activity_id AS "qboTimeActivityId",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.projectId,
        dto.userId,
        dto.milestoneId ?? null,
        dto.projectTimeCategoryId ?? null,
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
      `UPDATE time_entries SET project_id = $2, user_id = $3, milestone_id = $4,
              project_time_category_id = $5,
              date = $6, hours = $7, description = $8, billable = $9, updated_at = NOW()
       WHERE id = $1
       RETURNING id, project_id AS "projectId", user_id AS "userId",
                 milestone_id AS "milestoneId",
                 project_time_category_id AS "projectTimeCategoryId",
                 date, hours,
                 description, billable,
                 qbo_time_activity_id AS "qboTimeActivityId",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.projectId ?? existing.projectId,
        dto.userId ?? existing.userId,
        dto.milestoneId !== undefined ? dto.milestoneId : existing.milestoneId,
        dto.projectTimeCategoryId !== undefined
          ? dto.projectTimeCategoryId
          : existing.projectTimeCategoryId,
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
