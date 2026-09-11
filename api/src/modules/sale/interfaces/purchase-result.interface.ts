import { RejectionReason } from '../enums/rejection-reason.enum';
import { ResultStatus } from '../enums/result-status.enum';

export type PurchaseResult =
  | { status: ResultStatus.Success; orderId: number }
  | { status: ResultStatus.Rejected; reason: RejectionReason };
