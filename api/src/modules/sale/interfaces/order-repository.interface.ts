export abstract class OrderRepository {
  abstract remainingStock(saleId: string): Promise<number>;
}
