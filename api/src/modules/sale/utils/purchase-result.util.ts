import { RejectionReason } from '../enums/rejection-reason.enum';
import { ResultStatus } from '../enums/result-status.enum';
import { PurchaseResult } from '../interfaces/purchase-result.interface';

export function rejected(reason: RejectionReason): PurchaseResult {
  return { status: ResultStatus.Rejected, reason };
}
