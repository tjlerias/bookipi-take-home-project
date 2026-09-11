import { SaleStatus } from '../enums/sale-status.enum';

export interface SalePeriod {
  startsAt: Date;
  endsAt: Date;
}

export function computeStatus(
  sale: SalePeriod,
  now: Date,
  remaining: number,
): SaleStatus {
  if (now < sale.startsAt) {
    return SaleStatus.Upcoming;
  }

  if (now >= sale.endsAt) {
    return SaleStatus.Ended;
  }

  if (remaining <= 0) {
    return SaleStatus.SoldOut;
  }

  return SaleStatus.Active;
}
