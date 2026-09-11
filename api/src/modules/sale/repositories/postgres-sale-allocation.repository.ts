import { Injectable } from '@nestjs/common';
import { Queryable } from '../../../core/database/transaction';
import { SaleAllocationRepository } from '../interfaces/sale-allocation-repository.interface';

@Injectable()
export class PostgresSaleAllocationRepository implements SaleAllocationRepository {
  async allocate(
    tx: Queryable,
    saleId: string,
    productId: string,
    userId: string,
  ): Promise<boolean> {
    const result = await tx.query(
      `INSERT INTO sale_allocations (sale_id, product_id, user_id, units)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (sale_id, product_id, user_id)
       DO UPDATE
       SET units = sale_allocations.units + 1
       WHERE sale_allocations.units < (
           SELECT max_per_user
           FROM sale_items
           WHERE sale_id = $1
             AND product_id = $2
       )`,
      [saleId, productId, userId],
    );

    return (result.rowCount ?? 0) > 0;
  }
}
