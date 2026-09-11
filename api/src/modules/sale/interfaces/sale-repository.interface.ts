import { Queryable } from '../../../core/database/transaction';
import { SaleDetails } from './sale-details.interface';

export abstract class SaleRepository {
  abstract getSale(): Promise<SaleDetails | null>;
  abstract remainingStock(saleId: string, productId: string): Promise<number>;
  abstract decrementStock(
    tx: Queryable,
    saleId: string,
    productId: string,
  ): Promise<boolean>;
}
