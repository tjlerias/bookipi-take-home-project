import { Module } from '@nestjs/common';
import { AdmissionGateSeeder } from './gates/admission-gate.seeder';
import { RedisAdmissionGate } from './gates/redis-admission.gate';
import { AdmissionGate } from './interfaces/admission-gate.interface';
import { OrderRepository } from './interfaces/order-repository.interface';
import { PostgresOrderRepository } from './repositories/postgres-order.repository';
import { SaleController } from './sale.controller';
import { SaleService } from './sale.service';

@Module({
  controllers: [SaleController],
  providers: [
    SaleService,
    AdmissionGateSeeder,
    { provide: AdmissionGate, useClass: RedisAdmissionGate },
    { provide: OrderRepository, useClass: PostgresOrderRepository },
  ],
})
export class SaleModule {}
