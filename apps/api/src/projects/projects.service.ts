import {
  Injectable,
  Inject,
  NotFoundException,
} from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import type {
  Project,
  ProjectWithClient,
  ProjectFinancialSummary,
  CreateProjectDto,
  UpdateProjectDto,
} from "@interface/shared";

@Injectable()
export class ProjectsService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  private projectCodeDatePrefix(date = new Date()): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Vancouver",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const getPart = (type: string) =>
      parts.find((part) => part.type === type)?.value ?? "";
    return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
  }

  private async generateProjectCode(): Promise<string> {
    const prefix = this.projectCodeDatePrefix();
    const { rows } = await this.pool.query<{ code: string }>(
      "SELECT code FROM projects WHERE code LIKE $1",
      [`${prefix}%`],
    );

    const nextIndex =
      rows.reduce((max, row) => {
        const match = row.code.match(new RegExp(`^${prefix}(\\d+)$`));
        return match ? Math.max(max, Number(match[1])) : max;
      }, -1) + 1;

    return `${prefix}${nextIndex}`;
  }

  async findAll(includeArchived = false): Promise<ProjectWithClient[]> {
    const { rows } = await this.pool.query(
      `SELECT p.id, p.client_id AS "clientId", p.name, p.code, p.description, p.status, p.phase,
              p.start_date AS "startDate", p.end_date AS "endDate",
              p.budget_cents AS "budgetCents", p.budget_hours AS "budgetHours",
              p.project_manager_id AS "projectManagerId",
              p.google_drive_folder_id AS "googleDriveFolderId",
              p.created_at AS "createdAt", p.updated_at AS "updatedAt",
              json_build_object('id', c.id, 'name', c.name) AS client,
              CASE WHEN pm.id IS NOT NULL THEN json_build_object('id', pm.id, 'name', pm.name) ELSE NULL END AS "projectManager"
       FROM projects p
       JOIN clients c ON c.id = p.client_id
       LEFT JOIN users pm ON pm.id = p.project_manager_id
       WHERE ($1::boolean = TRUE OR (p.status != 'archived' AND c.archived_at IS NULL))
       ORDER BY p.updated_at DESC`,
      [includeArchived],
    );
    return rows;
  }

  async findById(id: string): Promise<ProjectWithClient> {
    const { rows } = await this.pool.query(
      `SELECT p.id, p.client_id AS "clientId", p.name, p.code, p.description, p.status, p.phase,
              p.start_date AS "startDate", p.end_date AS "endDate",
              p.budget_cents AS "budgetCents", p.budget_hours AS "budgetHours",
              p.project_manager_id AS "projectManagerId",
              p.google_drive_folder_id AS "googleDriveFolderId",
              p.created_at AS "createdAt", p.updated_at AS "updatedAt",
              json_build_object('id', c.id, 'name', c.name) AS client,
              CASE WHEN pm.id IS NOT NULL THEN json_build_object('id', pm.id, 'name', pm.name) ELSE NULL END AS "projectManager"
       FROM projects p
       JOIN clients c ON c.id = p.client_id
       LEFT JOIN users pm ON pm.id = p.project_manager_id
       WHERE p.id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Project not found");
    return rows[0];
  }

  async findByUser(userId: string): Promise<ProjectWithClient[]> {
    const { rows } = await this.pool.query(
      `SELECT p.id, p.client_id AS "clientId", p.name, p.code, p.description, p.status, p.phase,
              p.start_date AS "startDate", p.end_date AS "endDate",
              p.budget_cents AS "budgetCents", p.budget_hours AS "budgetHours",
              p.project_manager_id AS "projectManagerId",
              p.google_drive_folder_id AS "googleDriveFolderId",
              p.created_at AS "createdAt", p.updated_at AS "updatedAt",
              json_build_object('id', c.id, 'name', c.name) AS client,
              CASE WHEN pm.id IS NOT NULL THEN json_build_object('id', pm.id, 'name', pm.name) ELSE NULL END AS "projectManager"
       FROM projects p
       JOIN clients c ON c.id = p.client_id
       LEFT JOIN users pm ON pm.id = p.project_manager_id
       WHERE p.status != 'archived'
         AND c.archived_at IS NULL
         AND (p.project_manager_id = $1
          OR p.id IN (SELECT project_id FROM project_user_rates WHERE user_id = $1))
       ORDER BY p.updated_at DESC`,
      [userId],
    );
    return rows;
  }

  async create(dto: CreateProjectDto): Promise<Project> {
    const id = uuid();
    const projectCode = dto.code?.trim() || (await this.generateProjectCode());
    const { rows } = await this.pool.query(
      `INSERT INTO projects (id, client_id, name, code, description, status, phase, start_date, end_date, budget_cents, budget_hours, project_manager_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, client_id AS "clientId", name, code, description, status, phase,
                 start_date AS "startDate", end_date AS "endDate",
                 budget_cents AS "budgetCents", budget_hours AS "budgetHours",
                 project_manager_id AS "projectManagerId",
                 google_drive_folder_id AS "googleDriveFolderId",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.clientId,
        dto.name,
        projectCode,
        dto.description ?? null,
        dto.status ?? "draft",
        dto.phase ?? null,
        dto.startDate ?? null,
        dto.endDate ?? null,
        dto.budgetCents ?? null,
        dto.budgetHours ?? null,
        dto.projectManagerId ?? null,
      ],
    );
    return rows[0];
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    const existing = await this.findById(id);
    const { rows } = await this.pool.query(
      `UPDATE projects SET client_id = $2, name = $3, code = $4, description = $5, status = $6,
              phase = $7, start_date = $8, end_date = $9, budget_cents = $10, budget_hours = $11,
              project_manager_id = $12, updated_at = NOW()
       WHERE id = $1
       RETURNING id, client_id AS "clientId", name, code, description, status, phase,
                 start_date AS "startDate", end_date AS "endDate",
                 budget_cents AS "budgetCents", budget_hours AS "budgetHours",
                 project_manager_id AS "projectManagerId",
                 google_drive_folder_id AS "googleDriveFolderId",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.clientId ?? existing.clientId,
        dto.name ?? existing.name,
        dto.code !== undefined ? dto.code || null : existing.code,
        dto.description ?? existing.description,
        dto.status ?? existing.status,
        dto.phase ?? existing.phase,
        dto.startDate ?? existing.startDate,
        dto.endDate ?? existing.endDate,
        dto.budgetCents !== undefined ? dto.budgetCents : existing.budgetCents,
        dto.budgetHours !== undefined ? dto.budgetHours : existing.budgetHours,
        dto.projectManagerId !== undefined
          ? dto.projectManagerId || null
          : existing.projectManagerId,
      ],
    );
    return rows[0];
  }

  async archive(id: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE projects
       SET status_before_archive = status, status = 'archived', updated_at = NOW()
       WHERE id = $1 AND status != 'archived'`,
      [id],
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Project not found or already archived");
    }
  }

  async restore(id: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE projects p
       SET status = COALESCE(p.status_before_archive, 'draft'),
           status_before_archive = NULL,
           updated_at = NOW()
       FROM clients c
       WHERE p.id = $1
         AND p.client_id = c.id
         AND p.status = 'archived'
         AND c.archived_at IS NULL`,
      [id],
    );
    if (result.rowCount === 0) {
      throw new NotFoundException(
        "Project not found, not archived, or its client is still archived",
      );
    }
  }

  async findFinancialSummaries(): Promise<ProjectFinancialSummary[]> {
    const BURDEN_RATE = 1.15;
    const { rows } = await this.pool.query(
      `SELECT
         p.id,
         p.name,
         json_build_object('id', c.id, 'name', c.name) AS client,
         p.budget_cents AS "budgetCents",
         COALESCE(SUM(
           CASE WHEN te.billable AND COALESCE(tk.counts_toward_budget, true)
             THEN te.hours * COALESCE(pur.hourly_rate_cents, u.rate_cents)
             ELSE 0
           END
         ), 0)::bigint AS "budgetUsedCents",
         COALESCE(SUM(
           CASE WHEN te.billable
             THEN te.hours * COALESCE(pur.hourly_rate_cents, u.rate_cents)
             ELSE 0
           END
         ), 0)::bigint AS "revenueCents",
         COALESCE(SUM(
           te.hours * u.hourly_cost_cents * $1
         ), 0)::bigint AS "laborCostCents"
       FROM projects p
       JOIN clients c ON c.id = p.client_id
       LEFT JOIN time_entries te ON te.project_id = p.id
       LEFT JOIN tasks tk ON tk.id = te.task_id
       LEFT JOIN users u ON u.id = te.user_id
       LEFT JOIN project_user_rates pur
         ON pur.project_id = p.id AND pur.user_id = te.user_id
       WHERE p.status = 'active'
       GROUP BY p.id, p.name, p.budget_cents, c.id, c.name
       ORDER BY p.name`,
      [BURDEN_RATE],
    );
    return rows;
  }
}
