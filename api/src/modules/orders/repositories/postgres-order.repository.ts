import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../../core/database/database.providers';
import { Queryable } from '../../../core/database/transaction';
import { Order } from '../entities/order.entity';
import { OrderRepository } from '../interfaces/order-repository.interface';

interface OrderRow {
  id: number;
  sale_id: string;
  product_id: string;
  user_id: string;
  price_cents: number;
  created_at: Date;
}

@Injectable()
export class PostgresOrderRepository implements OrderRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(
    tx: Queryable,
    saleId: string,
    productId: string,
    userId: string,
  ): Promise<Order | null> {
    const result = await tx.query<OrderRow>(
      `INSERT INTO orders (sale_id, product_id, user_id, price_cents)
       SELECT sale_id, product_id, $3, sale_price_cents
       FROM sale_items
       WHERE sale_id = $1
         AND product_id = $2
       RETURNING id, sale_id, product_id, user_id, price_cents, created_at`,
      [saleId, productId, userId],
    );

    const row = result.rows[0];

    return row ? toOrder(row) : null;
  }

  async findByUser(saleId: string, userId: string): Promise<Order[]> {
    const result = await this.pool.query<OrderRow>(
      `SELECT id, sale_id, product_id, user_id, price_cents, created_at
       FROM orders
       WHERE sale_id = $1
         AND user_id = $2
       ORDER BY id`,
      [saleId, userId],
    );

    return result.rows.map(toOrder);
  }
}

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    saleId: row.sale_id,
    productId: row.product_id,
    userId: row.user_id,
    priceCents: row.price_cents,
    createdAt: row.created_at,
  };
}
