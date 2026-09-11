import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../../core/database/database.providers';
import { Queryable } from '../../../core/database/transaction';
import { SaleDetails } from '../interfaces/sale-details.interface';
import { SaleRepository } from '../interfaces/sale-repository.interface';

interface SaleRow {
  id: string;
  name: string;
  starts_at: Date;
  ends_at: Date;
  product_id: string;
  product_name: string;
  price_cents: number;
  sale_price_cents: number;
  max_per_user: number;
}

@Injectable()
export class PostgresSaleRepository implements SaleRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getSale(): Promise<SaleDetails | null> {
    const result = await this.pool.query<SaleRow>(
      `SELECT
          s.id,
          s.name,
          s.starts_at,
          s.ends_at,
          p.id AS product_id,
          p.name AS product_name,
          p.price_cents,
          i.sale_price_cents,
          i.max_per_user
       FROM sales s
       JOIN sale_items i ON i.sale_id = s.id
       JOIN products p ON p.id = i.product_id
       ORDER BY s.starts_at DESC
       LIMIT 1`,
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      item: {
        productId: row.product_id,
        name: row.product_name,
        priceCents: row.price_cents,
        salePriceCents: row.sale_price_cents,
        maxPerUser: row.max_per_user,
      },
    };
  }

  async remainingStock(saleId: string, productId: string): Promise<number> {
    const result = await this.pool.query<{ stock: number }>(
      `SELECT stock
       FROM sale_items
       WHERE sale_id = $1
         AND product_id = $2`,
      [saleId, productId],
    );

    return result.rows[0]?.stock ?? 0;
  }

  async decrementStock(
    tx: Queryable,
    saleId: string,
    productId: string,
  ): Promise<boolean> {
    const result = await tx.query(
      `UPDATE sale_items
       SET stock = stock - 1
       WHERE sale_id = $1
         AND product_id = $2
         AND stock > 0`,
      [saleId, productId],
    );

    return (result.rowCount ?? 0) > 0;
  }
}
