import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { HealthModule } from './modules/health/health.module';
import { SaleModule } from './modules/sale/sale.module';

@Module({
  imports: [CoreModule, HealthModule, SaleModule],
})
export class AppModule {}
