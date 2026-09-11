import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { errorMessage } from '../../../core/utils/error-message.util';
import { CurrentSaleService } from '../current-sale.service';
import { AdmissionGate } from '../interfaces/admission-gate.interface';
import { SaleRepository } from '../interfaces/sale-repository.interface';

@Injectable()
export class AdmissionGateSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdmissionGateSeeder.name);

  constructor(
    private readonly admissionGate: AdmissionGate,
    private readonly currentSaleService: CurrentSaleService,
    private readonly saleRepository: SaleRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const { id, item } = this.currentSaleService.getSale();

    try {
      const stock = await this.saleRepository.remainingStock(
        id,
        item.productId,
      );

      await this.admissionGate.seed(id, item.productId, stock);

      this.logger.log(`admission gate seeded for sale "${id}"`);
    } catch (err) {
      this.logger.warn(`could not seed admission gate: ${errorMessage(err)}`);
    }
  }
}
