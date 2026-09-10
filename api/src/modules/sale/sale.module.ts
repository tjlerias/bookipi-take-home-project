import { Module } from '@nestjs/common';
import { OrderRepository } from './interfaces/order-repository.interface';
import { PostgresOrderRepository } from './repositories/postgres-order.repository';
import { SaleController } from './sale.controller';
import { SaleService } from './sale.service';

@Module({
  controllers: [SaleController],
  providers: [
    SaleService,
    { provide: OrderRepository, useClass: PostgresOrderRepository },
  ],
})
export class SaleModule {}
