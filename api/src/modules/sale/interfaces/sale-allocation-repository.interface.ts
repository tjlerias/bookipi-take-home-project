import { Queryable } from '../../../core/database/transaction';

export abstract class SaleAllocationRepository {
  abstract allocate(
    tx: Queryable,
    saleId: string,
    productId: string,
    userId: string,
  ): Promise<boolean>;
}
