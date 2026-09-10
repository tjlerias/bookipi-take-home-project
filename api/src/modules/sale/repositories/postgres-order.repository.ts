import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../../core/database/database.providers';
import { Inventory } from '../entities/inventory.entity';
import { OrderRepository } from '../interfaces/order-repository.interface';

@Injectable()
export class PostgresOrderRepository implements OrderRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async remainingStock(saleId: string): Promise<number> {
    const result = await this.pool.query<Pick<Inventory, 'stock'>>(
      'SELECT stock FROM inventory WHERE sale_id = $1',
      [saleId],
    );
    return result.rows[0]?.stock ?? 0;
  }
}
