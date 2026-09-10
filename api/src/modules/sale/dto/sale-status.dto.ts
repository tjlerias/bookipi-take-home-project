import { SaleStatus } from '../interfaces/sale-status.interface';

export class SaleStatusDto {
  status: SaleStatus;
  startsAt: string;
  endsAt: string;
  serverTime: string;
  remaining: number;
}
