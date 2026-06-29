import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";
import type { PayPeriodLock } from "@interface/shared";

@Injectable()
export class PayPeriodLocksService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findForPeriod(
    periodStart: string,
    periodEnd: string,
  ): Promise<PayPeriodLock[]> {
    const { rows } = await this.pool.query(
      `SELECT ppl.id,
              ppl.period_start AS "periodStart",
              ppl.period_end AS "periodEnd",
              ppl.locked_by AS "lockedBy",
              ppl.locked_at AS "lockedAt",
              ppl.created_at AS "createdAt",
              ppl.updated_at AS "updatedAt",
              CASE WHEN lb.id IS NOT NULL
                   THEN json_build_object('id', lb.id, 'name', lb.name)
                   ELSE NULL END AS "lockedByUser"
       FROM pay_period_locks ppl
       LEFT JOIN users lb ON lb.id = ppl.locked_by
       WHERE ppl.period_start = $1
         AND ppl.period_end = $2
       ORDER BY ppl.locked_at DESC`,
      [periodStart, periodEnd],
    );
    return rows;
  }

  async createForPeriod(
    periodStart: string,
    periodEnd: string,
    lockedBy: string,
  ): Promise<PayPeriodLock[]> {
    if (periodStart > periodEnd) {
      throw new BadRequestException("Period start must be before period end");
    }

    await this.pool.query(
      `INSERT INTO pay_period_locks
         (id, period_start, period_end, locked_by)
       SELECT $1, $2, $3, $4
       WHERE NOT EXISTS (
         SELECT 1 FROM pay_period_locks
         WHERE period_start = $2
           AND period_end = $3
       )`,
      [uuid(), periodStart, periodEnd, lockedBy],
    );

    return this.findForPeriod(periodStart, periodEnd);
  }

  async remove(id: string): Promise<void> {
    const result = await this.pool.query(
      "DELETE FROM pay_period_locks WHERE id = $1",
      [id],
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Pay period lock not found");
    }
  }
}
