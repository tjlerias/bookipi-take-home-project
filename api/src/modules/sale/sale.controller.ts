import { Controller, Get } from '@nestjs/common';
import { SaleStatusDto } from './dto/sale-status.dto';
import { SaleService } from './sale.service';

@Controller('sale')
export class SaleController {
  constructor(private readonly sale: SaleService) {}

  @Get('status')
  status(): Promise<SaleStatusDto> {
    return this.sale.status();
  }
}
