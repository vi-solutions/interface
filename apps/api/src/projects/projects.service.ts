import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import type {
  Project,
  ProjectWithClient,
  CreateProjectDto,
  UpdateProjectDto,
} from "@interface/shared";

@Injectable()
export class ProjectsService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findAll(): Promise<ProjectWithClient[]> {
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
       ORDER BY p.updated_at DESC`,
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

  async create(dto: CreateProjectDto): Promise<Project> {
    const id = uuid();
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
        dto.code ?? null,
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
        dto.budgetCents ?? existing.budgetCents,
        dto.budgetHours !== undefined ? dto.budgetHours : existing.budgetHours,
        dto.projectManagerId !== undefined
          ? dto.projectManagerId || null
          : existing.projectManagerId,
      ],
    );
    return rows[0];
  }

  async remove(id: string): Promise<void> {
    const result = await this.pool.query("DELETE FROM projects WHERE id = $1", [
      id,
    ]);
    if (result.rowCount === 0) throw new NotFoundException("Project not found");
  }
}
