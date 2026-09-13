import { Queryable } from '../../src/core/database/transaction';
import { SaleAllocationRepository } from '../../src/modules/sale/interfaces/sale-allocation-repository.interface';
import { undoOf } from './memory-transaction.runner';

export class MemorySaleAllocationRepository implements SaleAllocationRepository {
  readonly quantity = new Map<string, number>();
  failWith?: Error;

  constructor(private readonly maxPerUser: number) {}

  async allocate(
    tx: Queryable,
    _saleId: string,
    _productId: string,
    userId: string,
  ): Promise<boolean> {
    if (this.failWith) {
      throw this.failWith;
    }
    const used = this.quantity.get(userId) ?? 0;
    if (used >= this.maxPerUser) {
      return false;
    }
    this.quantity.set(userId, used + 1);
    undoOf(tx).push(() => this.quantity.set(userId, used));
    return true;
  }
}
