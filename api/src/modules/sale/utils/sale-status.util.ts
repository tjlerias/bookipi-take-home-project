import { SaleConfig } from '../../../core/config/interfaces/app-config.interface';
import { SaleStatus } from '../interfaces/sale-status.interface';

export function computeStatus(
  sale: SaleConfig,
  now: Date,
  remaining: number,
): SaleStatus {
  if (now < sale.startsAt) {
    return 'upcoming';
  }

  if (now >= sale.endsAt) {
    return 'ended';
  }

  if (remaining <= 0) {
    return 'sold_out';
  }

  return 'active';
}
