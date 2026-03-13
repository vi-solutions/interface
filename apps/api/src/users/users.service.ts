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
  role: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<UserRow | null> {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, role, password_hash,
              created_at AS "created_at", updated_at AS "updated_at"
       FROM users WHERE email = $1`,
      [email],
    );
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<User> {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, role,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("User not found");
    return rows[0];
  }

  async findByIdWithHash(id: string): Promise<UserRow | null> {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, role, password_hash,
              created_at AS "created_at", updated_at AS "updated_at"
       FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async create(email: string, password: string, name: string): Promise<User> {
    const id = uuid();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await this.pool.query(
      `INSERT INTO users (id, email, name, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, email, name, passwordHash],
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
}
