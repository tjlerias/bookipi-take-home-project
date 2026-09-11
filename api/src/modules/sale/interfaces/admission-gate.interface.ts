import { StockRejection } from '../enums/rejection-reason.enum';
import { ResultStatus } from '../enums/result-status.enum';

export interface AdmitRequest {
  saleId: string;
  productId: string;
  userId: string;
  maxPerUser: number;
  now: Date;
}

export type AdmissionResult = ResultStatus.Success | StockRejection;

export abstract class AdmissionGate {
  abstract seed(
    saleId: string,
    productId: string,
    stock: number,
  ): Promise<void>;
  abstract admit(request: AdmitRequest): Promise<AdmissionResult>;
  abstract release(
    saleId: string,
    productId: string,
    userId: string,
  ): Promise<boolean>;
  abstract remainingTickets(
    saleId: string,
    productId: string,
  ): Promise<number | null>;
  abstract reset(saleId: string, productId: string): Promise<void>;
}
