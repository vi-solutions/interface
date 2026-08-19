import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import { QboSyncService } from "../quickbooks/qbo-sync.service";
import type {
  ExpenseType,
  UserExpense,
  UserExpenseWithDetails,
  UserExpenseReportEntry,
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
              ue.date::text AS date, ue.quantity, ue.total_cents AS "totalCents",
              ue.notes, ue.receipt_url AS "receiptUrl",
              ue.qbo_expense_id AS "qboExpenseId",
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

  async findByUser(userId: string): Promise<UserExpenseWithDetails[]> {
    const { rows } = await this.pool.query(
      `SELECT ue.id, ue.project_id AS "projectId", ue.user_id AS "userId",
              ue.project_expense_id AS "projectExpenseId",
              ue.date::text AS date, ue.quantity, ue.total_cents AS "totalCents",
              ue.notes, ue.receipt_url AS "receiptUrl",
              ue.qbo_expense_id AS "qboExpenseId",
              ue.created_at AS "createdAt", ue.updated_at AS "updatedAt",
              json_build_object('id', u.id, 'name', u.name) AS user,
              COALESCE(pe.name, e.name) AS "expenseName",
              COALESCE(pe.type, e.type) AS "expenseType"
       FROM user_expenses ue
       JOIN users u ON u.id = ue.user_id
       JOIN project_expenses pe ON pe.id = ue.project_expense_id
       LEFT JOIN expenses e ON e.id = pe.expense_id
       WHERE ue.user_id = $1
       ORDER BY ue.date DESC, ue.created_at DESC`,
      [userId],
    );
    return rows;
  }

  async findReport(opts: {
    startDate: string;
    endDate: string;
    userId?: string;
    clientId?: string;
    projectId?: string;
    expenseType?: ExpenseType;
    expenseName?: string;
    projectExpenseId?: string;
  }): Promise<UserExpenseReportEntry[]> {
    const params: unknown[] = [opts.startDate, opts.endDate];
    const conditions: string[] = ["ue.date >= $1", "ue.date <= $2"];

    if (opts.userId) {
      params.push(opts.userId);
      conditions.push(`ue.user_id = $${params.length}`);
    }
    if (opts.clientId) {
      params.push(opts.clientId);
      conditions.push(`c.id = $${params.length}`);
    }
    if (opts.projectId) {
      params.push(opts.projectId);
      conditions.push(`ue.project_id = $${params.length}`);
    }
    if (opts.expenseType) {
      params.push(opts.expenseType);
      conditions.push(`COALESCE(pe.type, e.type) = $${params.length}`);
    }
    if (opts.expenseName) {
      params.push(opts.expenseName);
      conditions.push(`COALESCE(pe.name, e.name) = $${params.length}`);
    }
    if (opts.projectExpenseId) {
      params.push(opts.projectExpenseId);
      conditions.push(`ue.project_expense_id = $${params.length}`);
    }

    const { rows } = await this.pool.query(
      `SELECT ue.id, ue.project_id AS "projectId", ue.user_id AS "userId",
              ue.project_expense_id AS "projectExpenseId",
              ue.date::text AS date, ue.quantity, ue.total_cents AS "totalCents",
              ue.notes, ue.receipt_url AS "receiptUrl",
              ue.qbo_expense_id AS "qboExpenseId",
              ue.created_at AS "createdAt", ue.updated_at AS "updatedAt",
              json_build_object('id', u.id, 'name', u.name) AS user,
              json_build_object('id', p.id, 'name', p.name) AS project,
              json_build_object('id', c.id, 'name', c.name) AS client,
              COALESCE(pe.name, e.name) AS "expenseName",
              COALESCE(pe.type, e.type) AS "expenseType"
       FROM user_expenses ue
       JOIN users u ON u.id = ue.user_id
       JOIN projects p ON p.id = ue.project_id
       JOIN clients c ON c.id = p.client_id
       JOIN project_expenses pe ON pe.id = ue.project_expense_id
       LEFT JOIN expenses e ON e.id = pe.expense_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY ue.date DESC, c.name ASC, p.name ASC, ue.created_at DESC`,
      params,
    );
    return rows;
  }

  async findReportCategories(): Promise<string[]> {
    const { rows } = await this.pool.query<{ name: string }>(
      `SELECT DISTINCT COALESCE(pe.name, e.name) AS name
       FROM user_expenses ue
       JOIN project_expenses pe ON pe.id = ue.project_expense_id
       LEFT JOIN expenses e ON e.id = pe.expense_id
       WHERE COALESCE(pe.name, e.name) IS NOT NULL
       ORDER BY name`,
    );
    return rows.map((row) => row.name);
  }

  async findById(id: string): Promise<UserExpense> {
    const { rows } = await this.pool.query(
      `SELECT id, project_id AS "projectId", user_id AS "userId",
              project_expense_id AS "projectExpenseId",
              date::text AS date, quantity, total_cents AS "totalCents",
              notes, receipt_url AS "receiptUrl",
              qbo_expense_id AS "qboExpenseId",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM user_expenses WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("User expense not found");
    return rows[0];
  }

  private async assertNotLocked(
    projectId: string,
    date: string,
  ): Promise<void> {
    const { rows } = await this.pool.query(
      `SELECT id FROM invoices
       WHERE project_id = $1
         AND period_start <= $2
         AND period_end >= $2
         AND status IN ('sent', 'paid')
       LIMIT 1`,
      [projectId, date],
    );
    if (rows[0]) {
      throw new ConflictException(
        "This entry falls within a locked (sent/paid) invoice period and cannot be modified.",
      );
    }
  }

  async create(dto: CreateUserExpenseDto): Promise<UserExpense> {
    await this.assertNotLocked(dto.projectId, dto.date);
    const id = uuid();
    const { rows } = await this.pool.query(
      `INSERT INTO user_expenses (id, project_id, user_id, project_expense_id, date, quantity, total_cents, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, project_id AS "projectId", user_id AS "userId",
                 project_expense_id AS "projectExpenseId",
                 date::text AS date, quantity, total_cents AS "totalCents",
                 notes, receipt_url AS "receiptUrl",
                 qbo_expense_id AS "qboExpenseId",
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
    await this.assertNotLocked(existing.projectId, existing.date);
    const newDate = dto.date ?? existing.date;
    if (newDate !== existing.date) {
      await this.assertNotLocked(existing.projectId, newDate);
    }

    const projectExpenseId = dto.projectExpenseId ?? existing.projectExpenseId;
    const { rows: projectExpenseRows } = await this.pool.query<{
      type: ExpenseType;
      rateCents: number;
    }>(
      `SELECT COALESCE(pe.type, e.type) AS type,
              COALESCE(pe.rate_cents, e.rate_cents) AS "rateCents"
       FROM project_expenses pe
       LEFT JOIN expenses e ON e.id = pe.expense_id
       WHERE pe.id = $1 AND pe.project_id = $2`,
      [projectExpenseId, existing.projectId],
    );
    const projectExpense = projectExpenseRows[0];
    if (!projectExpense) {
      throw new BadRequestException(
        "The selected expense category is not available on this project.",
      );
    }

    let quantity =
      dto.quantity !== undefined ? dto.quantity : existing.quantity;
    let totalCents = dto.totalCents ?? existing.totalCents;
    if (projectExpense.type === "dollar") {
      quantity = null;
    } else {
      quantity = Number(quantity ?? 0);
      totalCents = Math.round(quantity * Number(projectExpense.rateCents));
    }

    const { rows } = await this.pool.query(
      `UPDATE user_expenses SET project_expense_id = $2, date = $3,
              quantity = $4, total_cents = $5, notes = $6, updated_at = NOW()
       WHERE id = $1
       RETURNING id, project_id AS "projectId", user_id AS "userId",
                 project_expense_id AS "projectExpenseId",
                 date::text AS date, quantity, total_cents AS "totalCents",
                 notes, receipt_url AS "receiptUrl",
                 qbo_expense_id AS "qboExpenseId",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        projectExpenseId,
        dto.date ?? existing.date,
        quantity,
        totalCents,
        dto.notes ?? existing.notes,
      ],
    );
    // Fire-and-forget QBO sync
    this.qboSync.syncExpenseUpdate(id);
    return rows[0];
  }

  async saveReceiptUrl(id: string, receiptUrl: string | null): Promise<void> {
    await this.pool.query(
      `UPDATE user_expenses SET receipt_url = $2, updated_at = NOW() WHERE id = $1`,
      [id, receiptUrl],
    );
  }

  async remove(id: string): Promise<void> {
    const entry = await this.findById(id);
    await this.assertNotLocked(entry.projectId, entry.date);
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
