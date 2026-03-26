import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import type {
  ProjectExpense,
  CreateProjectExpenseDto,
  UpdateProjectExpenseDto,
} from "@interface/shared";

@Injectable()
export class ProjectExpensesService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  /**
   * Returns all project_expenses rows for a project, joined with
   * the parent global expense (if linked) to fill in name/type/description.
   */
  async findByProject(projectId: string): Promise<ProjectExpense[]> {
    const { rows } = await this.pool.query(
      `SELECT pe.id, pe.project_id AS "projectId", pe.expense_id AS "expenseId",
              COALESCE(pe.name, e.name) AS name,
              COALESCE(pe.description, e.description) AS description,
              COALESCE(pe.type, e.type) AS type,
              COALESCE(pe.rate_cents, e.rate_cents) AS "rateCents",
              pe.created_at AS "createdAt", pe.updated_at AS "updatedAt"
       FROM project_expenses pe
       LEFT JOIN expenses e ON e.id = pe.expense_id
       WHERE pe.project_id = $1
       ORDER BY COALESCE(pe.name, e.name)`,
      [projectId],
    );
    return rows;
  }

  async findById(id: string): Promise<ProjectExpense> {
    const { rows } = await this.pool.query(
      `SELECT pe.id, pe.project_id AS "projectId", pe.expense_id AS "expenseId",
              COALESCE(pe.name, e.name) AS name,
              COALESCE(pe.description, e.description) AS description,
              COALESCE(pe.type, e.type) AS type,
              pe.rate_cents AS "rateCents",
              pe.created_at AS "createdAt", pe.updated_at AS "updatedAt"
       FROM project_expenses pe
       LEFT JOIN expenses e ON e.id = pe.expense_id
       WHERE pe.id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Project expense not found");
    return rows[0];
  }

  /**
   * Create a project expense override (for an inherited expense)
   * or a project-specific custom expense (no expenseId).
   */
  async create(dto: CreateProjectExpenseDto): Promise<ProjectExpense> {
    const id = uuid();
    const { rows } = await this.pool.query(
      `INSERT INTO project_expenses (id, project_id, expense_id, name, description, type, rate_cents)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, project_id AS "projectId", expense_id AS "expenseId",
                 name, description, type, rate_cents AS "rateCents",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.projectId,
        dto.expenseId ?? null,
        dto.name ?? null,
        dto.description ?? null,
        dto.type ?? null,
        dto.rateCents,
      ],
    );
    return rows[0];
  }

  async update(
    id: string,
    dto: UpdateProjectExpenseDto,
  ): Promise<ProjectExpense> {
    const existing = await this.findById(id);
    const { rows } = await this.pool.query(
      `UPDATE project_expenses SET name = $2, description = $3, type = $4,
              rate_cents = $5, updated_at = NOW()
       WHERE id = $1
       RETURNING id, project_id AS "projectId", expense_id AS "expenseId",
                 name, description, type, rate_cents AS "rateCents",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.name ?? existing.name,
        dto.description ?? existing.description,
        dto.type ?? existing.type,
        dto.rateCents ?? existing.rateCents,
      ],
    );
    return rows[0];
  }

  async remove(id: string): Promise<void> {
    const result = await this.pool.query(
      "DELETE FROM project_expenses WHERE id = $1",
      [id],
    );
    if (result.rowCount === 0)
      throw new NotFoundException("Project expense not found");
  }
}
