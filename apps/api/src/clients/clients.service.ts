import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import type {
  Client,
  CreateClientDto,
  UpdateClientDto,
} from "@interface/shared";

@Injectable()
export class ClientsService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findAll(): Promise<Client[]> {
    const { rows } = await this.pool.query(
      `SELECT id, name, contact_name AS "contactName", contact_email AS "contactEmail",
              contact_phone AS "contactPhone", address, notes,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM clients ORDER BY name`,
    );
    return rows;
  }

  async findById(id: string): Promise<Client> {
    const { rows } = await this.pool.query(
      `SELECT id, name, contact_name AS "contactName", contact_email AS "contactEmail",
              contact_phone AS "contactPhone", address, notes,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM clients WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Client not found");
    return rows[0];
  }

  async create(dto: CreateClientDto): Promise<Client> {
    const id = uuid();
    const { rows } = await this.pool.query(
      `INSERT INTO clients (id, name, contact_name, contact_email, contact_phone, address, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, contact_name AS "contactName", contact_email AS "contactEmail",
                 contact_phone AS "contactPhone", address, notes,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.name,
        dto.contactName ?? null,
        dto.contactEmail ?? null,
        dto.contactPhone ?? null,
        dto.address ?? null,
        dto.notes ?? null,
      ],
    );
    return rows[0];
  }

  async update(id: string, dto: UpdateClientDto): Promise<Client> {
    const existing = await this.findById(id);
    const { rows } = await this.pool.query(
      `UPDATE clients SET name = $2, contact_name = $3, contact_email = $4,
              contact_phone = $5, address = $6, notes = $7, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, contact_name AS "contactName", contact_email AS "contactEmail",
                 contact_phone AS "contactPhone", address, notes,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.name ?? existing.name,
        dto.contactName ?? existing.contactName,
        dto.contactEmail ?? existing.contactEmail,
        dto.contactPhone ?? existing.contactPhone,
        dto.address ?? existing.address,
        dto.notes ?? existing.notes,
      ],
    );
    return rows[0];
  }

  async remove(id: string): Promise<void> {
    const result = await this.pool.query("DELETE FROM clients WHERE id = $1", [
      id,
    ]);
    if (result.rowCount === 0) throw new NotFoundException("Client not found");
  }
}
