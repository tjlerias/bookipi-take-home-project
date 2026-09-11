import { RejectionReason } from '../../src/modules/sale/enums/rejection-reason.enum';
import { ResultStatus } from '../../src/modules/sale/enums/result-status.enum';
import {
  AdmissionGate,
  AdmissionResult,
  AdmitRequest,
  GATE_UNSEEDED,
} from '../../src/modules/sale/interfaces/admission-gate.interface';

const LEASE_TTL_MS = 10_000;

export class MemoryAdmissionGate implements AdmissionGate {
  readonly leases = new Map<string, number>();
  readonly units = new Map<string, number>();
  failWith?: Error;

  constructor(public available: number | null) {}

  async seed(
    _saleId: string,
    _productId: string,
    stock: number,
  ): Promise<void> {
    if (this.available === null) {
      this.available = stock;
    }
  }

  async admit({
    userId,
    maxPerUser,
    now,
  }: AdmitRequest): Promise<AdmissionResult> {
    this.throwIfFailing();
    if (this.available === null) {
      return GATE_UNSEEDED;
    }
    this.purge(now);
    if (
      this.leases.has(userId) ||
      (this.units.get(userId) ?? 0) >= maxPerUser
    ) {
      return RejectionReason.LimitReached;
    }
    if (this.available - this.leases.size <= 0) {
      return RejectionReason.SoldOut;
    }
    this.leases.set(userId, now.getTime() + LEASE_TTL_MS);
    return ResultStatus.Success;
  }

  async confirm(
    _saleId: string,
    _productId: string,
    userId: string,
  ): Promise<void> {
    this.throwIfFailing();
    this.leases.delete(userId);
    this.available = (this.available ?? 0) - 1;
    this.units.set(userId, (this.units.get(userId) ?? 0) + 1);
  }

  async cancel(
    _saleId: string,
    _productId: string,
    userId: string,
  ): Promise<void> {
    this.throwIfFailing();
    this.leases.delete(userId);
  }

  async remainingStock(
    _saleId: string,
    _productId: string,
    now: Date,
  ): Promise<number | null> {
    this.throwIfFailing();
    if (this.available === null) {
      return null;
    }
    this.purge(now);
    return Math.max(this.available - this.leases.size, 0);
  }

  async reset(): Promise<void> {}

  private purge(now: Date): void {
    for (const [userId, expiresAt] of this.leases) {
      if (expiresAt <= now.getTime()) {
        this.leases.delete(userId);
      }
    }
  }

  private throwIfFailing(): void {
    if (this.failWith) {
      throw this.failWith;
    }
  }
}
