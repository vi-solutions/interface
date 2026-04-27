import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import type {
  Task,
  TaskUserBudget,
  TaskUserBudgetWithUser,
  CreateTaskDto,
  UpdateTaskDto,
  CreateTaskUserBudgetDto,
  UpdateTaskUserBudgetDto,
} from "@interface/shared";

@Injectable()
export class TasksService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findAll(): Promise<Task[]> {
    const { rows } = await this.pool.query(
      `SELECT id, project_id AS "projectId", name, description,
              budget_hours AS "budgetHours",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM tasks ORDER BY name`,
    );
    return rows;
  }

  async findByProject(projectId: string): Promise<Task[]> {
    const { rows } = await this.pool.query(
      `SELECT id, project_id AS "projectId", name, description,
              budget_hours AS "budgetHours",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM tasks WHERE project_id = $1 ORDER BY name`,
      [projectId],
    );
    return rows;
  }

  async findById(id: string): Promise<Task> {
    const { rows } = await this.pool.query(
      `SELECT id, project_id AS "projectId", name, description,
              budget_hours AS "budgetHours",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM tasks WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Task not found");
    return rows[0];
  }

  async create(dto: CreateTaskDto): Promise<Task> {
    const id = uuid();
    const { rows } = await this.pool.query(
      `INSERT INTO tasks (id, project_id, name, description, budget_hours)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, project_id AS "projectId", name, description,
                 budget_hours AS "budgetHours",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.projectId,
        dto.name,
        dto.description ?? null,
        dto.budgetHours ?? null,
      ],
    );
    return rows[0];
  }

  async update(id: string, dto: UpdateTaskDto): Promise<Task> {
    const existing = await this.findById(id);
    const { rows } = await this.pool.query(
      `UPDATE tasks SET name = $2, description = $3, budget_hours = $4, updated_at = NOW()
       WHERE id = $1
       RETURNING id, project_id AS "projectId", name, description,
                 budget_hours AS "budgetHours",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.name ?? existing.name,
        dto.description !== undefined ? dto.description : existing.description,
        dto.budgetHours !== undefined ? dto.budgetHours : existing.budgetHours,
      ],
    );
    return rows[0];
  }

  async remove(id: string): Promise<void> {
    const result = await this.pool.query("DELETE FROM tasks WHERE id = $1", [
      id,
    ]);
    if (result.rowCount === 0) throw new NotFoundException("Task not found");
  }

  // ── Per-employee budgets ────────────────────────────────────────────────

  async findUserBudgetsByTask(
    taskId: string,
  ): Promise<TaskUserBudgetWithUser[]> {
    const { rows } = await this.pool.query(
      `SELECT tub.id, tub.task_id AS "taskId", tub.user_id AS "userId",
              tub.budget_hours AS "budgetHours",
              tub.created_at AS "createdAt", tub.updated_at AS "updatedAt",
              json_build_object('id', u.id, 'name', u.name) AS user
       FROM task_user_budgets tub
       JOIN users u ON u.id = tub.user_id
       WHERE tub.task_id = $1
       ORDER BY u.name`,
      [taskId],
    );
    return rows;
  }

  async findUserBudgetById(id: string): Promise<TaskUserBudget> {
    const { rows } = await this.pool.query(
      `SELECT id, task_id AS "taskId", user_id AS "userId",
              budget_hours AS "budgetHours",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM task_user_budgets WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Task user budget not found");
    return rows[0];
  }

  async createUserBudget(
    dto: CreateTaskUserBudgetDto,
  ): Promise<TaskUserBudget> {
    const id = uuid();
    const { rows } = await this.pool.query(
      `INSERT INTO task_user_budgets (id, task_id, user_id, budget_hours)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (task_id, user_id) DO UPDATE
         SET budget_hours = EXCLUDED.budget_hours, updated_at = NOW()
       RETURNING id, task_id AS "taskId", user_id AS "userId",
                 budget_hours AS "budgetHours",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, dto.taskId, dto.userId, dto.budgetHours ?? null],
    );
    return rows[0];
  }

  async updateUserBudget(
    id: string,
    dto: UpdateTaskUserBudgetDto,
  ): Promise<TaskUserBudget> {
    const { rows } = await this.pool.query(
      `UPDATE task_user_budgets SET budget_hours = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, task_id AS "taskId", user_id AS "userId",
                 budget_hours AS "budgetHours",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, dto.budgetHours ?? null],
    );
    if (!rows[0]) throw new NotFoundException("Task user budget not found");
    return rows[0];
  }

  async removeUserBudget(id: string): Promise<void> {
    const result = await this.pool.query(
      "DELETE FROM task_user_budgets WHERE id = $1",
      [id],
    );
    if (result.rowCount === 0)
      throw new NotFoundException("Task user budget not found");
  }
}
