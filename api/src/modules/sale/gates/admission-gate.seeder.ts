import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { APP_CONFIG } from '../../../core/config/config.module';
import type { AppConfig } from '../../../core/config/interfaces/app-config.interface';
import { AdmissionGate } from '../interfaces/admission-gate.interface';
import { OrderRepository } from '../interfaces/order-repository.interface';

@Injectable()
export class AdmissionGateSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdmissionGateSeeder.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly gate: AdmissionGate,
    private readonly orders: OrderRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const { id } = this.config.sale;

    try {
      const stock = await this.orders.remainingStock(id);
      await this.gate.seed(id, stock);
      this.logger.log(`admission gate seeded for sale "${id}"`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`could not seed admission gate: ${reason}`);
    }
  }
}
