import { Inject, Injectable } from '@nestjs/common';
import { Clock } from '../../core/clock/interfaces/clock.interface';
import { APP_CONFIG } from '../../core/config/config.module';
import type { AppConfig } from '../../core/config/interfaces/app-config.interface';
import { SaleStatusDto } from './dto/sale-status.dto';
import { OrderRepository } from './interfaces/order-repository.interface';
import { computeStatus } from './utils/sale-status.util';

@Injectable()
export class SaleService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly clock: Clock,
    private readonly orders: OrderRepository,
  ) {}

  async status(): Promise<SaleStatusDto> {
    const { sale } = this.config;
    const now = this.clock.now();
    const remaining = await this.orders.remainingStock(sale.id);

    return {
      status: computeStatus(sale, now, remaining),
      startsAt: sale.startsAt.toISOString(),
      endsAt: sale.endsAt.toISOString(),
      serverTime: now.toISOString(),
      remaining,
    };
  }
}
