import { Module } from '@nestjs/common';
import { OrderRepository } from './interfaces/order-repository.interface';
import { PostgresOrderRepository } from './repositories/postgres-order.repository';

@Module({
  providers: [{ provide: OrderRepository, useClass: PostgresOrderRepository }],
  exports: [OrderRepository],
})
export class OrdersModule {}
