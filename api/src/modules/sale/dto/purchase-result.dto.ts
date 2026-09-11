import { ResultStatus } from '../enums/result-status.enum';

export class PurchaseResultDto {
  result: ResultStatus.Success;
  orderId: number;
}
