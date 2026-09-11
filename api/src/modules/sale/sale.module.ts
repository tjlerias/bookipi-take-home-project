import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { CurrentSaleService } from './current-sale.service';
import { AdmissionGateSeeder } from './gates/admission-gate.seeder';
import { RedisAdmissionGate } from './gates/redis-admission.gate';
import { AdmissionGate } from './interfaces/admission-gate.interface';
import { SaleAllocationRepository } from './interfaces/sale-allocation-repository.interface';
import { SaleRepository } from './interfaces/sale-repository.interface';
import { PostgresSaleAllocationRepository } from './repositories/postgres-sale-allocation.repository';
import { PostgresSaleRepository } from './repositories/postgres-sale.repository';
import { SaleController } from './sale.controller';
import { SaleService } from './sale.service';

@Module({
  imports: [OrdersModule],
  controllers: [SaleController],
  providers: [
    CurrentSaleService,
    SaleService,
    AdmissionGateSeeder,
    { provide: AdmissionGate, useClass: RedisAdmissionGate },
    { provide: SaleRepository, useClass: PostgresSaleRepository },
    {
      provide: SaleAllocationRepository,
      useClass: PostgresSaleAllocationRepository,
    },
  ],
})
export class SaleModule {}
