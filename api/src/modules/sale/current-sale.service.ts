import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SaleDetails } from './interfaces/sale-details.interface';
import { SaleRepository } from './interfaces/sale-repository.interface';

@Injectable()
export class CurrentSaleService implements OnModuleInit {
  private readonly logger = new Logger(CurrentSaleService.name);
  private sale?: SaleDetails;

  constructor(private readonly saleRepository: SaleRepository) {}

  async onModuleInit(): Promise<void> {
    const sale = await this.saleRepository.getSale();

    if (!sale) {
      throw new Error('no sale found in the database: run `npm run db:seed`');
    }

    this.sale = sale;

    this.logger.log(
      `loaded sale "${sale.id}" for product "${sale.item.productId}"`,
    );
  }

  getSale(): SaleDetails {
    if (!this.sale) {
      throw new Error('sale not loaded yet');
    }

    return this.sale;
  }
}
