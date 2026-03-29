import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import { QboSyncService } from "../quickbooks/qbo-sync.service";
import type {
  UserExpense,
  UserExpenseWithDetails,
  CreateUserExpenseDto,
  UpdateUserExpenseDto,
} from "@interface/shared";

@Injectable()
export class UserExpensesService {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly qboSync: QboSyncService,
  ) {}

  async findByProject(projectId: string): Promise<UserExpenseWithDetails[]> {
    const { rows } = await this.pool.query(
      `SELECT ue.id, ue.project_id AS "projectId", ue.user_id AS "userId",
              ue.project_expense_id AS "projectExpenseId",
              ue.date, ue.quantity, ue.total_cents AS "totalCents",
              ue.notes, ue.qbo_expense_id AS "qboExpenseId",
              ue.created_at AS "createdAt", ue.updated_at AS "updatedAt",
              json_build_object('id', u.id, 'name', u.name) AS user,
              COALESCE(pe.name, e.name) AS "expenseName",
              COALESCE(pe.type, e.type) AS "expenseType"
       FROM user_expenses ue
       JOIN users u ON u.id = ue.user_id
       JOIN project_expenses pe ON pe.id = ue.project_expense_id
       LEFT JOIN expenses e ON e.id = pe.expense_id
       WHERE ue.project_id = $1
       ORDER BY ue.date DESC, ue.created_at DESC`,
      [projectId],
    );
    return rows;
  }

  async findById(id: string): Promise<UserExpense> {
    const { rows } = await this.pool.query(
      `SELECT id, project_id AS "projectId", user_id AS "userId",
              project_expense_id AS "projectExpenseId",
              date, quantity, total_cents AS "totalCents",
              notes, qbo_expense_id AS "qboExpenseId",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM user_expenses WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("User expense not found");
    return rows[0];
  }

  async create(dto: CreateUserExpenseDto): Promise<UserExpense> {
    const id = uuid();
    const { rows } = await this.pool.query(
      `INSERT INTO user_expenses (id, project_id, user_id, project_expense_id, date, quantity, total_cents, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, project_id AS "projectId", user_id AS "userId",
                 project_expense_id AS "projectExpenseId",
                 date, quantity, total_cents AS "totalCents",
                 notes, qbo_expense_id AS "qboExpenseId",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.projectId,
        dto.userId,
        dto.projectExpenseId,
        dto.date,
        dto.quantity ?? null,
        dto.totalCents,
        dto.notes ?? null,
      ],
    );
    // Fire-and-forget QBO sync
    this.qboSync.syncExpenseCreate(id);
    return rows[0];
  }

  async update(id: string, dto: UpdateUserExpenseDto): Promise<UserExpense> {
    const existing = await this.findById(id);
    const { rows } = await this.pool.query(
      `UPDATE user_expenses SET date = $2, quantity = $3, total_cents = $4,
              notes = $5, updated_at = NOW()
       WHERE id = $1
       RETURNING id, project_id AS "projectId", user_id AS "userId",
                 project_expense_id AS "projectExpenseId",
                 date, quantity, total_cents AS "totalCents",
                 notes, qbo_expense_id AS "qboExpenseId",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.date ?? existing.date,
        dto.quantity ?? existing.quantity,
        dto.totalCents ?? existing.totalCents,
        dto.notes ?? existing.notes,
      ],
    );
    // Fire-and-forget QBO sync
    this.qboSync.syncExpenseUpdate(id);
    return rows[0];
  }

  async remove(id: string): Promise<void> {
    // Sync delete before removing the row (need qbo_expense_id)
    await this.qboSync.syncExpenseDelete(id);
    const result = await this.pool.query(
      "DELETE FROM user_expenses WHERE id = $1",
      [id],
    );
    if (result.rowCount === 0)
      throw new NotFoundException("User expense not found");
  }
}
