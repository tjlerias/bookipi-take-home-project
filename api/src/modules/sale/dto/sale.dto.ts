import { SaleStatus } from '../enums/sale-status.enum';

export class SaleItemDto {
  productId: string;
  name: string;
  priceCents: number;
  salePriceCents: number;
  maxPerUser: number;
  remainingStock: number;
}

export class SaleDto {
  id: string;
  name: string;
  status: SaleStatus;
  startsAt: string;
  endsAt: string;
  serverTime: string;
  item: SaleItemDto;
}
