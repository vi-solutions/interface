import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import type {
  Expense,
  CreateExpenseDto,
  UpdateExpenseDto,
} from "@interface/shared";

@Injectable()
export class ExpensesService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findAll(): Promise<Expense[]> {
    const { rows } = await this.pool.query(
      `SELECT id, name, description, type,
              rate_cents AS "rateCents",
              archived_at AS "archivedAt",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM expenses WHERE archived_at IS NULL ORDER BY name`,
    );
    return rows;
  }

  async findArchived(): Promise<Expense[]> {
    const { rows } = await this.pool.query(
      `SELECT id, name, description, type,
              rate_cents AS "rateCents",
              archived_at AS "archivedAt",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM expenses WHERE archived_at IS NOT NULL ORDER BY name`,
    );
    return rows;
  }

  async findById(id: string): Promise<Expense> {
    const { rows } = await this.pool.query(
      `SELECT id, name, description, type,
              rate_cents AS "rateCents",
              archived_at AS "archivedAt",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM expenses WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Expense not found");
    return rows[0];
  }

  async create(dto: CreateExpenseDto): Promise<Expense> {
    const id = uuid();
    const { rows } = await this.pool.query(
      `INSERT INTO expenses (id, name, description, type, rate_cents)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, description, type,
                 rate_cents AS "rateCents",
                 archived_at AS "archivedAt",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, dto.name, dto.description ?? null, dto.type, dto.rateCents ?? 0],
    );
    return rows[0];
  }

  async update(id: string, dto: UpdateExpenseDto): Promise<Expense> {
    const existing = await this.findById(id);
    const { rows } = await this.pool.query(
      `UPDATE expenses SET name = $2, description = $3, type = $4,
              rate_cents = $5, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, description, type,
                 rate_cents AS "rateCents",
                 archived_at AS "archivedAt",
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

  async archive(id: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE expenses SET archived_at = NOW(), updated_at = NOW() WHERE id = $1 AND archived_at IS NULL`,
      [id],
    );
    if (result.rowCount === 0) throw new NotFoundException("Expense not found");
  }

  async unarchive(id: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE expenses SET archived_at = NULL, updated_at = NOW() WHERE id = $1 AND archived_at IS NOT NULL`,
      [id],
    );
    if (result.rowCount === 0) throw new NotFoundException("Expense not found");
  }
}
