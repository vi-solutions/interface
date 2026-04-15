import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import type {
  Client,
  ClientWithPrimaryContact,
  CreateClientDto,
  UpdateClientDto,
} from "@interface/shared";

@Injectable()
export class ClientsService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findAll(): Promise<ClientWithPrimaryContact[]> {
    const { rows } = await this.pool.query(
      `SELECT c.id, c.name, c.address, c.notes,
              c.qbo_customer_id AS "qboCustomerId",
              c.created_at AS "createdAt", c.updated_at AS "updatedAt",
              CASE WHEN pc.id IS NOT NULL
                THEN json_build_object('id', pc.id, 'name', pc.name, 'email', pc.email, 'title', pc.title)
                ELSE NULL
              END AS "primaryContact"
       FROM clients c
       LEFT JOIN LATERAL (
         SELECT id, name, email, title
         FROM contacts
         WHERE client_id = c.id
         ORDER BY created_at ASC
         LIMIT 1
       ) pc ON true
       ORDER BY c.name`,
    );
    return rows;
  }

  async findById(id: string): Promise<Client> {
    const { rows } = await this.pool.query(
      `SELECT id, name, address, notes,
              qbo_customer_id AS "qboCustomerId",
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
      `INSERT INTO clients (id, name, address, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, address, notes,
                 qbo_customer_id AS "qboCustomerId",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, dto.name, dto.address ?? null, dto.notes ?? null],
    );
    return rows[0];
  }

  async update(id: string, dto: UpdateClientDto): Promise<Client> {
    const existing = await this.findById(id);
    const { rows } = await this.pool.query(
      `UPDATE clients SET name = $2, address = $3, notes = $4, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, address, notes,
                 qbo_customer_id AS "qboCustomerId",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        dto.name ?? existing.name,
        dto.address !== undefined ? dto.address || null : existing.address,
        dto.notes !== undefined ? dto.notes || null : existing.notes,
      ],
    );
    return rows[0];
  }

  async linkQboCustomer(
    id: string,
    qboCustomerId: string | null,
  ): Promise<Client> {
    const { rows } = await this.pool.query(
      `UPDATE clients SET qbo_customer_id = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, address, notes,
                 qbo_customer_id AS "qboCustomerId",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, qboCustomerId],
    );
    if (!rows[0]) throw new NotFoundException("Client not found");
    return rows[0];
  }

  async remove(id: string): Promise<void> {
    const result = await this.pool.query("DELETE FROM clients WHERE id = $1", [
      id,
    ]);
    if (result.rowCount === 0) throw new NotFoundException("Client not found");
  }
}
