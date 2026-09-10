export type AdmissionResult = 'admitted' | 'already_admitted' | 'sold_out';

export abstract class AdmissionGate {
  abstract seed(saleId: string, stock: number): Promise<void>;
  abstract admit(
    saleId: string,
    userId: string,
    now: Date,
  ): Promise<AdmissionResult>;
  abstract release(saleId: string, userId: string): Promise<boolean>;
  abstract remaining(saleId: string): Promise<number | null>;
  abstract reset(saleId: string): Promise<void>;
}
