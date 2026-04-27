import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import { QuickbooksService } from "../quickbooks/quickbooks.service";
import type {
  Invoice,
  InvoiceWithDetails,
  InvoiceListItem,
  InvoiceLineItem,
  InvoicePreview,
  InvoiceLineItemDto,
  CreateInvoiceDto,
} from "@interface/shared";

@Injectable()
export class InvoicesService {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly qbo: QuickbooksService,
  ) {}

  /* ------------------------------------------------------------------ */
  /*  Preview — aggregate billable data without persisting               */
  /* ------------------------------------------------------------------ */

  async preview(
    projectId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<InvoicePreview> {
    // Project name
    const { rows: projectRows } = await this.pool.query(
      `SELECT p.name, c.qbo_customer_id
       FROM projects p JOIN clients c ON c.id = p.client_id
       WHERE p.id = $1`,
      [projectId],
    );
    if (!projectRows[0]) throw new NotFoundException("Project not found");
    const { name: projectName } = projectRows[0];

    // Billable time entries grouped by user, joined with their hourly rate
    const { rows: timeRows } = await this.pool.query(
      `SELECT u.id AS user_id, u.name AS user_name,
              SUM(te.hours) AS total_hours,
              pur.hourly_rate_cents
       FROM time_entries te
       JOIN users u ON u.id = te.user_id
       LEFT JOIN project_user_rates pur
              ON pur.project_id = te.project_id AND pur.user_id = te.user_id
       WHERE te.project_id = $1
         AND te.billable = true
         AND te.date >= $2
         AND te.date <= $3
       GROUP BY u.id, u.name, pur.hourly_rate_cents
       ORDER BY u.name`,
      [projectId, periodStart, periodEnd],
    );

    // Billable user expenses
    const { rows: expenseRows } = await this.pool.query(
      `SELECT ue.total_cents, ue.notes,
              COALESCE(pe.name, e.name) AS expense_name
       FROM user_expenses ue
       JOIN project_expenses pe ON pe.id = ue.project_expense_id
       LEFT JOIN expenses e ON e.id = pe.expense_id
       WHERE ue.project_id = $1
         AND ue.date >= $2
         AND ue.date <= $3
       ORDER BY ue.date`,
      [projectId, periodStart, periodEnd],
    );

    const lineItems: InvoiceLineItemDto[] = [];
    let sortOrder = 0;

    for (const row of timeRows) {
      const hours = Number(row.total_hours);
      const rateCents = row.hourly_rate_cents
        ? Number(row.hourly_rate_cents)
        : 0;
      lineItems.push({
        type: "time",
        description: `Time — ${row.user_name}`,
        quantity: Math.round(hours * 100) / 100,
        unitCents: rateCents,
      });
      sortOrder++;
    }

    for (const row of expenseRows) {
      const desc = row.notes
        ? `${row.expense_name} — ${row.notes}`
        : row.expense_name;
      lineItems.push({
        type: "expense",
        description: desc,
        quantity: 1,
        unitCents: Number(row.total_cents),
      });
      sortOrder++;
    }

    const totalCents = lineItems.reduce(
      (s, li) => s + Math.round(li.quantity * li.unitCents),
      0,
    );

    return {
      projectId,
      projectName,
      periodStart,
      periodEnd,
      lineItems,
      totalCents,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  CRUD                                                               */
  /* ------------------------------------------------------------------ */

  async findAll(): Promise<InvoiceListItem[]> {
    const { rows } = await this.pool.query(
      `SELECT i.id, i.project_id AS "projectId",
              i.period_start AS "periodStart", i.period_end AS "periodEnd",
              i.status, i.qbo_invoice_id AS "qboInvoiceId",
              i.notes, i.due_date AS "dueDate",
              i.total_cents AS "totalCents",
              i.created_at AS "createdAt", i.updated_at AS "updatedAt",
              json_build_object('id', p.id, 'name', p.name) AS project
       FROM invoices i
       JOIN projects p ON p.id = i.project_id
       WHERE i.status != 'void'
       ORDER BY i.created_at DESC`,
    );
    return rows;
  }

  async findById(id: string): Promise<InvoiceWithDetails> {
    const { rows } = await this.pool.query(
      `SELECT i.id, i.project_id AS "projectId",
              i.period_start AS "periodStart", i.period_end AS "periodEnd",
              i.status, i.qbo_invoice_id AS "qboInvoiceId",
              i.notes, i.due_date AS "dueDate",
              i.total_cents AS "totalCents",
              i.created_at AS "createdAt", i.updated_at AS "updatedAt",
              json_build_object('id', p.id, 'name', p.name) AS project
       FROM invoices i
       JOIN projects p ON p.id = i.project_id
       WHERE i.id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Invoice not found");

    const { rows: lineItems } = await this.pool.query(
      `SELECT id, invoice_id AS "invoiceId", type, description,
              quantity, unit_cents AS "unitCents", total_cents AS "totalCents",
              sort_order AS "sortOrder", created_at AS "createdAt"
       FROM invoice_line_items
       WHERE invoice_id = $1
       ORDER BY sort_order`,
      [id],
    );

    return { ...rows[0], lineItems };
  }

  async create(dto: CreateInvoiceDto): Promise<InvoiceWithDetails> {
    // Validate project exists and has a QBO customer
    const { rows: projectRows } = await this.pool.query(
      `SELECT p.name, c.qbo_customer_id
       FROM projects p JOIN clients c ON c.id = p.client_id
       WHERE p.id = $1`,
      [dto.projectId],
    );
    if (!projectRows[0]) throw new NotFoundException("Project not found");

    const { qbo_customer_id: customerRef } = projectRows[0];
    if (!customerRef) {
      throw new BadRequestException(
        "This project's client is not linked to a QuickBooks customer.",
      );
    }

    const totalCents = dto.lineItems.reduce(
      (s, li) => s + Math.round(li.quantity * li.unitCents),
      0,
    );

    // Push to QBO first — if it fails, don't save locally
    const conn = await this.qbo.getConnection();
    let qboInvoiceId: string | null = null;
    if (conn) {
      qboInvoiceId = await this.qbo.createInvoice({
        customerRef,
        txnDate: dto.periodEnd,
        dueDate: dto.dueDate,
        memo: dto.notes ?? undefined,
        lineItems: dto.lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unitCents: li.unitCents,
        })),
      });
    }

    // Persist
    const invoiceId = uuid();
    await this.pool.query(
      `INSERT INTO invoices
         (id, project_id, period_start, period_end, status, qbo_invoice_id,
          notes, due_date, total_cents)
       VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8)`,
      [
        invoiceId,
        dto.projectId,
        dto.periodStart,
        dto.periodEnd,
        qboInvoiceId,
        dto.notes ?? null,
        dto.dueDate ?? null,
        totalCents,
      ],
    );

    for (let i = 0; i < dto.lineItems.length; i++) {
      const li = dto.lineItems[i];
      const liTotalCents = Math.round(li.quantity * li.unitCents);
      await this.pool.query(
        `INSERT INTO invoice_line_items
           (id, invoice_id, type, description, quantity, unit_cents, total_cents, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          uuid(),
          invoiceId,
          li.type,
          li.description,
          li.quantity,
          li.unitCents,
          liTotalCents,
          i,
        ],
      );
    }

    return this.findById(invoiceId);
  }

  async remove(id: string): Promise<void> {
    const { rows } = await this.pool.query(
      "SELECT qbo_invoice_id FROM invoices WHERE id = $1",
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Invoice not found");

    if (rows[0].qbo_invoice_id) {
      try {
        await this.qbo.deleteInvoice(rows[0].qbo_invoice_id);
      } catch {
        // Already voided in QBO — continue
      }
    }

    await this.pool.query(
      "UPDATE invoices SET status = 'void', updated_at = NOW() WHERE id = $1",
      [id],
    );
  }
}
