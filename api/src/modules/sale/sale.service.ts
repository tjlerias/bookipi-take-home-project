import { Inject, Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../core/clock/interfaces/clock.interface';
import { APP_CONFIG } from '../../core/config/config.module';
import type { AppConfig } from '../../core/config/interfaces/app-config.interface';
import { SaleStatusDto } from './dto/sale-status.dto';
import { AdmissionGate } from './interfaces/admission-gate.interface';
import { OrderRepository } from './interfaces/order-repository.interface';
import { computeStatus } from './utils/sale-status.util';

@Injectable()
export class SaleService {
  private readonly logger = new Logger(SaleService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly clock: Clock,
    private readonly gate: AdmissionGate,
    private readonly orders: OrderRepository,
  ) {}

  async status(): Promise<SaleStatusDto> {
    const { sale } = this.config;
    const now = this.clock.now();
    const remaining = await this.remaining(sale.id);

    return {
      status: computeStatus(sale, now, remaining),
      startsAt: sale.startsAt.toISOString(),
      endsAt: sale.endsAt.toISOString(),
      serverTime: now.toISOString(),
      remaining,
    };
  }

  private async remaining(saleId: string): Promise<number> {
    try {
      const fromGate = await this.gate.remaining(saleId);
      if (fromGate !== null) {
        return fromGate;
      }
    } catch (err) {
      this.logger.warn(
        `gate unavailable, reading stock from database: ${message(err)}`,
      );
    }
    return this.orders.remainingStock(saleId);
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
