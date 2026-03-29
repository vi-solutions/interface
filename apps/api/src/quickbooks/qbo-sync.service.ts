import { Injectable, Inject, Logger } from "@nestjs/common";
import { Pool } from "pg";
import { DATABASE_POOL } from "../db/database.module";
import { QuickbooksService } from "./quickbooks.service";

/**
 * Handles automatic syncing of time entries and user expenses to QBO.
 * All sync methods are fire-and-forget safe — failures are logged but
 * never bubble up to break the caller's request.
 */
@Injectable()
export class QboSyncService {
  private readonly logger = new Logger(QboSyncService.name);

  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly qbo: QuickbooksService,
  ) {}

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  /** Returns the QBO Customer ID for a time entry's project→client chain, or null */
  private async getQboCustomerForProject(
    projectId: string,
  ): Promise<string | null> {
    const { rows } = await this.pool.query(
      `SELECT c.qbo_customer_id
       FROM projects p
       JOIN clients c ON c.id = p.client_id
       WHERE p.id = $1`,
      [projectId],
    );
    return rows[0]?.qbo_customer_id ?? null;
  }

  /** Check whether a QBO connection exists */
  private async isConnected(): Promise<boolean> {
    const conn = await this.qbo.getConnection();
    return conn !== null;
  }

  /* ------------------------------------------------------------------ */
  /*  Time Entry sync                                                    */
  /* ------------------------------------------------------------------ */

  async syncTimeEntryCreate(timeEntryId: string): Promise<void> {
    try {
      if (!(await this.isConnected())) return;

      const { rows } = await this.pool.query(
        `SELECT te.id, te.project_id, te.date, te.hours, te.description, te.billable,
                u.name AS user_name,
                COALESCE(ptc.name, tc.name) AS category_name
         FROM time_entries te
         JOIN users u ON u.id = te.user_id
         LEFT JOIN project_time_categories ptc ON ptc.id = te.project_time_category_id
         LEFT JOIN time_categories tc ON tc.id = ptc.time_category_id
         WHERE te.id = $1`,
        [timeEntryId],
      );
      const entry = rows[0];
      if (!entry) return;

      const customerRef = await this.getQboCustomerForProject(entry.project_id);
      if (!customerRef) return; // Client not linked to QBO

      const totalHours = Number(entry.hours);
      const wholeHours = Math.floor(totalHours);
      const minutes = Math.round((totalHours - wholeHours) * 60);
      const dateStr =
        typeof entry.date === "string"
          ? entry.date.slice(0, 10)
          : new Date(entry.date).toISOString().slice(0, 10);

      const desc = [entry.category_name, entry.description]
        .filter(Boolean)
        .join(": ");

      const qboId = await this.qbo.createTimeActivity({
        customerRef,
        hours: wholeHours,
        minutes,
        date: dateStr,
        description: desc,
        employeeName: entry.user_name,
        billable: entry.billable,
      });

      await this.pool.query(
        "UPDATE time_entries SET qbo_time_activity_id = $1 WHERE id = $2",
        [qboId, timeEntryId],
      );
      this.logger.log(`Synced time entry ${timeEntryId} → QBO ${qboId}`);
    } catch (err) {
      this.logger.error(`Failed to sync time entry ${timeEntryId}`, err);
    }
  }

  async syncTimeEntryUpdate(timeEntryId: string): Promise<void> {
    try {
      if (!(await this.isConnected())) return;

      const { rows } = await this.pool.query(
        `SELECT te.id, te.project_id, te.date, te.hours, te.description,
                te.billable, te.qbo_time_activity_id,
                u.name AS user_name,
                COALESCE(ptc.name, tc.name) AS category_name
         FROM time_entries te
         JOIN users u ON u.id = te.user_id
         LEFT JOIN project_time_categories ptc ON ptc.id = te.project_time_category_id
         LEFT JOIN time_categories tc ON tc.id = ptc.time_category_id
         WHERE te.id = $1`,
        [timeEntryId],
      );
      const entry = rows[0];
      if (!entry || !entry.qbo_time_activity_id) return;

      const customerRef = await this.getQboCustomerForProject(entry.project_id);
      if (!customerRef) return;

      const totalHours = Number(entry.hours);
      const wholeHours = Math.floor(totalHours);
      const minutes = Math.round((totalHours - wholeHours) * 60);
      const dateStr =
        typeof entry.date === "string"
          ? entry.date.slice(0, 10)
          : new Date(entry.date).toISOString().slice(0, 10);

      const desc = [entry.category_name, entry.description]
        .filter(Boolean)
        .join(": ");

      await this.qbo.updateTimeActivity(entry.qbo_time_activity_id, {
        customerRef,
        hours: wholeHours,
        minutes,
        date: dateStr,
        description: desc,
        employeeName: entry.user_name,
        billable: entry.billable,
      });
      this.logger.log(`Updated QBO time activity for ${timeEntryId}`);
    } catch (err) {
      this.logger.error(`Failed to sync time entry update ${timeEntryId}`, err);
    }
  }

  async syncTimeEntryDelete(timeEntryId: string): Promise<void> {
    try {
      if (!(await this.isConnected())) return;

      const { rows } = await this.pool.query(
        "SELECT qbo_time_activity_id FROM time_entries WHERE id = $1",
        [timeEntryId],
      );
      const qboId = rows[0]?.qbo_time_activity_id;
      if (!qboId) return;

      await this.qbo.deleteTimeActivity(qboId);
      this.logger.log(`Deleted QBO time activity ${qboId}`);
    } catch (err) {
      this.logger.error(
        `Failed to delete QBO time activity for ${timeEntryId}`,
        err,
      );
    }
  }

  /* ------------------------------------------------------------------ */
  /*  User Expense sync                                                  */
  /* ------------------------------------------------------------------ */

  async syncExpenseCreate(userExpenseId: string): Promise<void> {
    try {
      if (!(await this.isConnected())) return;

      const { rows } = await this.pool.query(
        `SELECT ue.id, ue.project_id, ue.date, ue.total_cents, ue.notes,
                COALESCE(pe.name, e.name) AS expense_name,
                u.name AS user_name
         FROM user_expenses ue
         JOIN users u ON u.id = ue.user_id
         JOIN project_expenses pe ON pe.id = ue.project_expense_id
         LEFT JOIN expenses e ON e.id = pe.expense_id
         WHERE ue.id = $1`,
        [userExpenseId],
      );
      const expense = rows[0];
      if (!expense) return;

      const customerRef = await this.getQboCustomerForProject(
        expense.project_id,
      );
      if (!customerRef) return;

      const dateStr =
        typeof expense.date === "string"
          ? expense.date.slice(0, 10)
          : new Date(expense.date).toISOString().slice(0, 10);

      const qboId = await this.qbo.createExpense({
        customerRef,
        totalDollars: Number(expense.total_cents) / 100,
        date: dateStr,
        description: `${expense.expense_name}${expense.notes ? ` — ${expense.notes}` : ""}`,
      });

      await this.pool.query(
        "UPDATE user_expenses SET qbo_expense_id = $1 WHERE id = $2",
        [qboId, userExpenseId],
      );
      this.logger.log(`Synced expense ${userExpenseId} → QBO ${qboId}`);
    } catch (err) {
      this.logger.error(`Failed to sync expense ${userExpenseId}`, err);
    }
  }

  async syncExpenseUpdate(userExpenseId: string): Promise<void> {
    try {
      if (!(await this.isConnected())) return;

      const { rows } = await this.pool.query(
        `SELECT ue.id, ue.project_id, ue.date, ue.total_cents, ue.notes,
                ue.qbo_expense_id,
                COALESCE(pe.name, e.name) AS expense_name
         FROM user_expenses ue
         JOIN project_expenses pe ON pe.id = ue.project_expense_id
         LEFT JOIN expenses e ON e.id = pe.expense_id
         WHERE ue.id = $1`,
        [userExpenseId],
      );
      const expense = rows[0];
      if (!expense || !expense.qbo_expense_id) return;

      const customerRef = await this.getQboCustomerForProject(
        expense.project_id,
      );
      if (!customerRef) return;

      const dateStr =
        typeof expense.date === "string"
          ? expense.date.slice(0, 10)
          : new Date(expense.date).toISOString().slice(0, 10);

      await this.qbo.updateExpense(expense.qbo_expense_id, {
        customerRef,
        totalDollars: Number(expense.total_cents) / 100,
        date: dateStr,
        description: `${expense.expense_name}${expense.notes ? ` — ${expense.notes}` : ""}`,
      });
      this.logger.log(`Updated QBO expense for ${userExpenseId}`);
    } catch (err) {
      this.logger.error(`Failed to sync expense update ${userExpenseId}`, err);
    }
  }

  async syncExpenseDelete(userExpenseId: string): Promise<void> {
    try {
      if (!(await this.isConnected())) return;

      const { rows } = await this.pool.query(
        "SELECT qbo_expense_id FROM user_expenses WHERE id = $1",
        [userExpenseId],
      );
      const qboId = rows[0]?.qbo_expense_id;
      if (!qboId) return;

      await this.qbo.deleteExpense(qboId);
      this.logger.log(`Deleted QBO expense ${qboId}`);
    } catch (err) {
      this.logger.error(
        `Failed to delete QBO expense for ${userExpenseId}`,
        err,
      );
    }
  }
}
