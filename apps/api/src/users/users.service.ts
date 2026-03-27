import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import * as bcrypt from "bcrypt";
import { DATABASE_POOL } from "../db/database.module";
import type { User } from "@interface/shared";

const SALT_ROUNDS = 10;

interface UserRow {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findAll(): Promise<User[]> {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, is_admin AS "isAdmin",
              rate_cents AS "rateCents",
              hourly_cost_cents AS "hourlyCostCents",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users ORDER BY name`,
    );
    return rows;
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, is_admin, password_hash,
              created_at AS "created_at", updated_at AS "updated_at"
       FROM users WHERE email = $1`,
      [email],
    );
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<User> {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, is_admin AS "isAdmin",
              rate_cents AS "rateCents",
              hourly_cost_cents AS "hourlyCostCents",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("User not found");
    return rows[0];
  }

  async findByIdWithHash(id: string): Promise<UserRow | null> {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, is_admin, password_hash,
              created_at AS "created_at", updated_at AS "updated_at"
       FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async create(
    email: string,
    password: string,
    name: string,
    rateCents?: number,
    hourlyCostCents?: number,
  ): Promise<User> {
    const id = uuid();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await this.pool.query(
      `INSERT INTO users (id, email, name, password_hash, rate_cents, hourly_cost_cents)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, name, is_admin AS "isAdmin",
                 rate_cents AS "rateCents",
                 hourly_cost_cents AS "hourlyCostCents",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, email, name, passwordHash, rateCents ?? 0, hourlyCostCents ?? 0],
    );
    return rows[0];
  }

  async verifyPassword(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
  }

  async updatePassword(id: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.pool.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [passwordHash, id],
    );
  }

  async update(
    id: string,
    fields: {
      name?: string;
      email?: string;
      isAdmin?: boolean;
      rateCents?: number;
      hourlyCostCents?: number;
    },
  ): Promise<User> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (fields.name !== undefined) {
      sets.push(`name = $${idx++}`);
      values.push(fields.name);
    }
    if (fields.email !== undefined) {
      sets.push(`email = $${idx++}`);
      values.push(fields.email);
    }
    if (fields.isAdmin !== undefined) {
      sets.push(`is_admin = $${idx++}`);
      values.push(fields.isAdmin);
    }
    if (fields.rateCents !== undefined) {
      sets.push(`rate_cents = $${idx++}`);
      values.push(fields.rateCents);
    }
    if (fields.hourlyCostCents !== undefined) {
      sets.push(`hourly_cost_cents = $${idx++}`);
      values.push(fields.hourlyCostCents);
    }

    if (sets.length === 0) return this.findById(id);

    sets.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await this.pool.query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${idx}
       RETURNING id, email, name, is_admin AS "isAdmin",
                 rate_cents AS "rateCents",
                 hourly_cost_cents AS "hourlyCostCents",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      values,
    );
    if (!rows[0]) throw new NotFoundException("User not found");
    return rows[0];
  }

  async setAdmin(id: string, isAdmin: boolean): Promise<User> {
    const { rows } = await this.pool.query(
      `UPDATE users SET is_admin = $2, updated_at = NOW() WHERE id = $1
       RETURNING id, email, name, is_admin AS "isAdmin",
                 rate_cents AS "rateCents",
                 hourly_cost_cents AS "hourlyCostCents",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, isAdmin],
    );
    if (!rows[0]) throw new NotFoundException("User not found");
    return rows[0];
  }
}
