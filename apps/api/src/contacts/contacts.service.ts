import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import type {
  Contact,
  CreateContactDto,
  UpdateContactDto,
} from "@interface/shared";

@Injectable()
export class ContactsService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findAll(): Promise<Contact[]> {
    const { rows } = await this.pool.query(
      `SELECT id, client_id AS "clientId", name, email, phone, title, agency,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM contacts ORDER BY name`,
    );
    return rows;
  }

  async findByClient(clientId: string): Promise<Contact[]> {
    const { rows } = await this.pool.query(
      `SELECT id, client_id AS "clientId", name, email, phone, title, agency,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM contacts WHERE client_id = $1 ORDER BY name`,
      [clientId],
    );
    return rows;
  }

  async findById(id: string): Promise<Contact> {
    const { rows } = await this.pool.query(
      `SELECT id, client_id AS "clientId", name, email, phone, title, agency,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM contacts WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Contact not found");
    return rows[0];
  }

  async create(dto: CreateContactDto): Promise<Contact> {
    const id = uuid();
    const { rows } = await this.pool.query(
      `INSERT INTO contacts (id, client_id, name, email, phone, title, agency)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, client_id AS "clientId", name, email, phone, title, agency,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.clientId ?? null,
        dto.name,
        dto.email ?? null,
        dto.phone ?? null,
        dto.title ?? null,
        dto.agency ?? null,
      ],
    );
    return rows[0];
  }

  async update(id: string, dto: UpdateContactDto): Promise<Contact> {
    const existing = await this.findById(id);
    const { rows } = await this.pool.query(
      `UPDATE contacts SET name = $2, email = $3, phone = $4, title = $5, agency = $6, updated_at = NOW()
       WHERE id = $1
       RETURNING id, client_id AS "clientId", name, email, phone, title, agency,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.name ?? existing.name,
        dto.email !== undefined ? dto.email : existing.email,
        dto.phone !== undefined ? dto.phone : existing.phone,
        dto.title !== undefined ? dto.title : existing.title,
        dto.agency !== undefined ? dto.agency : existing.agency,
      ],
    );
    return rows[0];
  }

  async remove(id: string): Promise<void> {
    const result = await this.pool.query("DELETE FROM contacts WHERE id = $1", [
      id,
    ]);
    if (result.rowCount === 0) throw new NotFoundException("Contact not found");
  }
}
