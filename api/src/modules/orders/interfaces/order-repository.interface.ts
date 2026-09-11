import { Queryable } from '../../../core/database/transaction';
import { Order } from '../entities/order.entity';

export abstract class OrderRepository {
  abstract insert(
    tx: Queryable,
    saleId: string,
    productId: string,
    userId: string,
  ): Promise<Order | null>;
  abstract findByUser(saleId: string, userId: string): Promise<Order[]>;
}
