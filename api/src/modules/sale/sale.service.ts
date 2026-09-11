import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Clock } from '../../core/clock/interfaces/clock.interface';
import { TransactionRunner } from '../../core/database/transaction';
import { errorMessage } from '../../core/utils/error-message.util';
import { OrderRepository } from '../orders/interfaces/order-repository.interface';
import { CurrentSaleService } from './current-sale.service';
import { SaleDto } from './dto/sale.dto';
import { UserPurchasesDto } from './dto/user-purchases.dto';
import { RejectionReason } from './enums/rejection-reason.enum';
import { ResultStatus } from './enums/result-status.enum';
import {
  AdmissionGate,
  AdmitRequest,
} from './interfaces/admission-gate.interface';
import { PurchaseResult } from './interfaces/purchase-result.interface';
import { SaleAllocationRepository } from './interfaces/sale-allocation-repository.interface';
import { SaleRepository } from './interfaces/sale-repository.interface';
import { rejected } from './utils/purchase-result.util';
import { computeStatus } from './utils/sale-status.util';

const GATE_BYPASSED = 'bypassed';

@Injectable()
export class SaleService {
  private readonly logger = new Logger(SaleService.name);

  constructor(
    private readonly admissionGate: AdmissionGate,
    private readonly clock: Clock,
    private readonly currentSaleService: CurrentSaleService,
    private readonly saleAllocationRepository: SaleAllocationRepository,
    private readonly saleRepository: SaleRepository,
    private readonly transactionRunner: TransactionRunner,
    private readonly orderRepository: OrderRepository,
  ) {}

  async getSale(): Promise<SaleDto> {
    const sale = this.currentSaleService.getSale();
    const now = this.clock.now();
    const remainingStock = await this.remainingStock(
      sale.id,
      sale.item.productId,
    );

    return {
      id: sale.id,
      name: sale.name,
      status: computeStatus(sale, now, remainingStock),
      startsAt: sale.startsAt.toISOString(),
      endsAt: sale.endsAt.toISOString(),
      serverTime: now.toISOString(),
      item: { ...sale.item, remainingStock: remainingStock },
    };
  }

  async purchase(userId: string): Promise<PurchaseResult> {
    const sale = this.currentSaleService.getSale();
    const { productId, maxPerUser } = sale.item;
    const now = this.clock.now();

    if (now < sale.startsAt) {
      return rejected(RejectionReason.Upcoming);
    }

    if (now >= sale.endsAt) {
      return rejected(RejectionReason.Ended);
    }

    const admission = await this.admit({
      saleId: sale.id,
      productId,
      userId,
      maxPerUser,
      now,
    });

    if (admission !== ResultStatus.Success && admission !== GATE_BYPASSED) {
      return rejected(admission);
    }

    const holdsTicket = admission === ResultStatus.Success;

    let result: PurchaseResult;
    try {
      result = await this.reserve(sale.id, productId, userId);
    } catch (err) {
      this.logger.error(
        `order write failed for ${userId}: ${errorMessage(err)}`,
      );

      if (holdsTicket) {
        await this.releaseQuietly(sale.id, productId, userId);
      }

      throw new ServiceUnavailableException({ error: 'service unavailable' });
    }

    if (result.status === ResultStatus.Rejected && holdsTicket) {
      this.logger.warn(
        `gate admitted ${userId} but database rejected: ${result.reason}`,
      );

      if (result.reason === RejectionReason.LimitReached) {
        await this.releaseQuietly(sale.id, productId, userId);
      }
    }

    return result;
  }

  async getUserPurchases(userId: string): Promise<UserPurchasesDto> {
    const sale = this.currentSaleService.getSale();
    const orders = await this.orderRepository.findByUser(sale.id, userId);

    return {
      purchased: orders.length > 0,
      unitsUsed: orders.length,
      maxPerUser: sale.item.maxPerUser,
      orders: orders.map((order) => ({
        orderId: order.id,
        priceCents: order.priceCents,
        purchasedAt: order.createdAt.toISOString(),
      })),
    };
  }

  // Only repository calls belong inside this transaction.
  // It holds a pooled connection.
  private reserve(
    saleId: string,
    productId: string,
    userId: string,
  ): Promise<PurchaseResult> {
    return this.transactionRunner.run(async (tx) => {
      const allocated = await this.saleAllocationRepository.allocate(
        tx,
        saleId,
        productId,
        userId,
      );

      if (!allocated) {
        tx.rollback();
        return rejected(RejectionReason.LimitReached);
      }

      const order = await this.orderRepository.insert(
        tx,
        saleId,
        productId,
        userId,
      );

      const decremented =
        order !== null &&
        (await this.saleRepository.decrementStock(tx, saleId, productId));

      if (!order || !decremented) {
        tx.rollback();
        return rejected(RejectionReason.SoldOut);
      }

      return { status: ResultStatus.Success, orderId: order.id };
    });
  }

  private async admit(request: AdmitRequest) {
    try {
      return await this.admissionGate.admit(request);
    } catch (err) {
      this.logger.warn(
        `gate unavailable, admitting ${request.userId} directly to database: ${errorMessage(err)}`,
      );

      return GATE_BYPASSED;
    }
  }

  private async releaseQuietly(
    saleId: string,
    productId: string,
    userId: string,
  ): Promise<void> {
    try {
      await this.admissionGate.release(saleId, productId, userId);
    } catch (err) {
      this.logger.warn(
        `could not release ticket for ${userId}: ${errorMessage(err)}`,
      );
    }
  }

  private async remainingStock(
    saleId: string,
    productId: string,
  ): Promise<number> {
    try {
      const remainingTickets = await this.admissionGate.remainingTickets(
        saleId,
        productId,
      );

      if (remainingTickets !== null) {
        return remainingTickets;
      }
    } catch (err) {
      this.logger.warn(
        `gate unavailable, reading stock from database: ${errorMessage(err)}`,
      );
    }

    return this.saleRepository.remainingStock(saleId, productId);
  }
}
