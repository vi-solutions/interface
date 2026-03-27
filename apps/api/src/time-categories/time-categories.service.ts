import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import type {
  TimeCategory,
  CreateTimeCategoryDto,
  UpdateTimeCategoryDto,
} from "@interface/shared";

@Injectable()
export class TimeCategoriesService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findAll(): Promise<TimeCategory[]> {
    const { rows } = await this.pool.query(
      `SELECT id, name, description,
              archived_at AS "archivedAt",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM time_categories WHERE archived_at IS NULL ORDER BY name`,
    );
    return rows;
  }

  async findArchived(): Promise<TimeCategory[]> {
    const { rows } = await this.pool.query(
      `SELECT id, name, description,
              archived_at AS "archivedAt",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM time_categories WHERE archived_at IS NOT NULL ORDER BY name`,
    );
    return rows;
  }

  async findById(id: string): Promise<TimeCategory> {
    const { rows } = await this.pool.query(
      `SELECT id, name, description,
              archived_at AS "archivedAt",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM time_categories WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Time category not found");
    return rows[0];
  }

  async create(dto: CreateTimeCategoryDto): Promise<TimeCategory> {
    const id = uuid();
    const { rows } = await this.pool.query(
      `INSERT INTO time_categories (id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, description,
                 archived_at AS "archivedAt",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, dto.name, dto.description ?? null],
    );
    return rows[0];
  }

  async update(id: string, dto: UpdateTimeCategoryDto): Promise<TimeCategory> {
    const existing = await this.findById(id);
    const { rows } = await this.pool.query(
      `UPDATE time_categories SET name = $2, description = $3,
              updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, description,
                 archived_at AS "archivedAt",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, dto.name ?? existing.name, dto.description ?? existing.description],
    );
    return rows[0];
  }

  async archive(id: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE time_categories SET archived_at = NOW(), updated_at = NOW() WHERE id = $1 AND archived_at IS NULL`,
      [id],
    );
    if (result.rowCount === 0)
      throw new NotFoundException("Time category not found");
  }

  async unarchive(id: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE time_categories SET archived_at = NULL, updated_at = NOW() WHERE id = $1 AND archived_at IS NOT NULL`,
      [id],
    );
    if (result.rowCount === 0)
      throw new NotFoundException("Time category not found");
  }
}
