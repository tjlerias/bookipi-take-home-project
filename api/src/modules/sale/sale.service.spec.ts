import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Clock } from '../../core/clock/interfaces/clock.interface';
import {
  Queryable,
  Transaction,
  TransactionRunner,
} from '../../core/database/transaction';
import { Order } from '../orders/entities/order.entity';
import { OrderRepository } from '../orders/interfaces/order-repository.interface';
import { CurrentSaleService } from './current-sale.service';
import { RejectionReason } from './enums/rejection-reason.enum';
import { ResultStatus } from './enums/result-status.enum';
import { SaleStatus } from './enums/sale-status.enum';
import {
  AdmissionGate,
  AdmissionResult,
  AdmitRequest,
} from './interfaces/admission-gate.interface';
import { SaleAllocationRepository } from './interfaces/sale-allocation-repository.interface';
import { SaleDetails } from './interfaces/sale-details.interface';
import { SaleRepository } from './interfaces/sale-repository.interface';
import { SaleService } from './sale.service';

const SALE = 'test';

class FakeTransaction implements Transaction {
  readonly undo: Array<() => void> = [];
  rolledBack = false;

  query(): never {
    throw new Error('fakes do not run SQL');
  }

  rollback(): void {
    this.rolledBack = true;
  }
}

class FakeTransactionRunner implements TransactionRunner {
  async run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    const tx = new FakeTransaction();
    try {
      const result = await work(tx);

      if (tx.rolledBack) {
        tx.undo.reverse().forEach((undo) => undo());
      }

      return result;
    } catch (err) {
      tx.undo.reverse().forEach((undo) => undo());
      throw err;
    }
  }
}

function undoOf(tx: Queryable): Array<() => void> {
  return (tx as FakeTransaction).undo;
}

class MemorySales implements SaleRepository {
  constructor(
    private readonly sale: SaleDetails,
    public stock: number,
  ) {}

  async getSale(): Promise<SaleDetails> {
    return this.sale;
  }

  async remainingStock(): Promise<number> {
    return this.stock;
  }

  async decrementStock(tx: Queryable): Promise<boolean> {
    if (this.stock <= 0) {
      return false;
    }

    const before = this.stock;
    this.stock -= 1;
    undoOf(tx).push(() => (this.stock = before));

    return true;
  }
}

class MemoryAllocations implements SaleAllocationRepository {
  readonly units = new Map<string, number>();
  failWith?: Error;

  constructor(private readonly maxPerUser: number) {}

  async allocate(
    tx: Queryable,
    _saleId: string,
    _productId: string,
    userId: string,
  ): Promise<boolean> {
    const { maxPerUser } = this;

    if (this.failWith) {
      throw this.failWith;
    }

    const used = this.units.get(userId) ?? 0;
    if (used >= maxPerUser) {
      return false;
    }

    this.units.set(userId, used + 1);
    undoOf(tx).push(() => this.units.set(userId, used));

    return true;
  }
}

class MemoryOrders implements OrderRepository {
  readonly orders: Order[] = [];

  async insert(
    tx: Queryable,
    saleId: string,
    productId: string,
    userId: string,
  ): Promise<Order | null> {
    const order: Order = {
      id: this.orders.length + 1,
      saleId,
      productId,
      userId,
      priceCents: 1000,
      createdAt: new Date('2026-01-01T10:30:00Z'),
    };

    this.orders.push(order);
    undoOf(tx).push(() => this.orders.pop());

    return order;
  }

  async findByUser(_saleId: string, userId: string): Promise<Order[]> {
    return this.orders.filter((o) => o.userId === userId);
  }
}

class MemoryGate implements AdmissionGate {
  readonly units = new Map<string, number>();
  failWith?: Error;

  constructor(public tickets: number | null) {}

  async seed(): Promise<void> {}

  async admit({ userId, maxPerUser }: AdmitRequest): Promise<AdmissionResult> {
    this.throwIfFailing();

    if ((this.units.get(userId) ?? 0) >= maxPerUser) {
      return RejectionReason.LimitReached;
    }

    if ((this.tickets ?? 0) <= 0) {
      return RejectionReason.SoldOut;
    }

    this.tickets = (this.tickets ?? 0) - 1;
    this.units.set(userId, (this.units.get(userId) ?? 0) + 1);

    return ResultStatus.Success;
  }

  async release(
    _saleId: string,
    _productId: string,
    userId: string,
  ): Promise<boolean> {
    this.throwIfFailing();

    const held = this.units.get(userId) ?? 0;
    if (held <= 0) {
      return false;
    }

    if (held === 1) {
      this.units.delete(userId);
    } else {
      this.units.set(userId, held - 1);
    }

    this.tickets = (this.tickets ?? 0) + 1;

    return true;
  }

  async remainingTickets(): Promise<number | null> {
    this.throwIfFailing();
    return this.tickets;
  }

  async reset(): Promise<void> {}

  private throwIfFailing(): void {
    if (this.failWith) {
      throw this.failWith;
    }
  }
}

function makeSale(maxPerUser: number): SaleDetails {
  return {
    id: SALE,
    name: 'Test Sale',
    startsAt: new Date('2026-01-01T10:00:00Z'),
    endsAt: new Date('2026-01-01T11:00:00Z'),
    item: {
      productId: 'sneaker',
      name: 'Sneaker',
      priceCents: 19900,
      salePriceCents: 14900,
      maxPerUser,
    },
  };
}

const INSIDE = new Date('2026-01-01T10:30:00Z');

interface Deps {
  now?: Date;
  maxPerUser?: number;
  gateTickets?: number | null;
  dbStock?: number;
}

async function build({
  now = INSIDE,
  maxPerUser = 1,
  gateTickets = 5,
  dbStock = 5,
}: Deps = {}) {
  const sale = makeSale(maxPerUser);
  const gate = new MemoryGate(gateTickets);
  const sales = new MemorySales(sale, dbStock);
  const allocations = new MemoryAllocations(maxPerUser);
  const orders = new MemoryOrders();
  const clock: Clock = { now: () => now };
  const moduleRef = await Test.createTestingModule({
    providers: [
      SaleService,
      { provide: CurrentSaleService, useValue: { getSale: () => sale } },
      { provide: Clock, useValue: clock },
      { provide: AdmissionGate, useValue: gate },
      { provide: TransactionRunner, useValue: new FakeTransactionRunner() },
      { provide: SaleRepository, useValue: sales },
      { provide: SaleAllocationRepository, useValue: allocations },
      { provide: OrderRepository, useValue: orders },
    ],
  }).compile();

  return {
    service: moduleRef.get(SaleService),
    gate,
    sales,
    allocations,
    orders,
  };
}

const limitReached = {
  status: ResultStatus.Rejected,
  reason: RejectionReason.LimitReached,
};
const soldOut = {
  status: ResultStatus.Rejected,
  reason: RejectionReason.SoldOut,
};

describe('SaleService.getSale', () => {
  it('returns the sale, product, server time, and remaining stock', async () => {
    const { service } = await build();

    await expect(service.getSale()).resolves.toEqual({
      id: SALE,
      name: 'Test Sale',
      status: SaleStatus.Active,
      startsAt: '2026-01-01T10:00:00.000Z',
      endsAt: '2026-01-01T11:00:00.000Z',
      serverTime: '2026-01-01T10:30:00.000Z',
      item: {
        productId: 'sneaker',
        name: 'Sneaker',
        priceCents: 19900,
        salePriceCents: 14900,
        maxPerUser: 1,
        remainingStock: 5,
      },
    });
  });

  it('prefers the gate ticket count over the database', async () => {
    const { service } = await build({ gateTickets: 2, dbStock: 5 });

    await expect(service.getSale()).resolves.toMatchObject({
      item: { remainingStock: 2 },
    });
  });

  it('falls back to the database when the gate is unseeded', async () => {
    const { service } = await build({ gateTickets: null, dbStock: 3 });

    await expect(service.getSale()).resolves.toMatchObject({
      item: { remainingStock: 3 },
    });
  });

  it('falls back to the database when the gate is unavailable', async () => {
    const { service, gate } = await build({ dbStock: 4 });
    gate.failWith = new Error('connection refused');

    await expect(service.getSale()).resolves.toMatchObject({
      item: { remainingStock: 4 },
    });
  });

  it('reports sold_out when nothing remains', async () => {
    const { service } = await build({ gateTickets: 0 });

    await expect(service.getSale()).resolves.toMatchObject({
      status: SaleStatus.SoldOut,
      item: { remainingStock: 0 },
    });
  });
});

describe('SaleService.purchase', () => {
  it('rejects before the window opens without touching the gate', async () => {
    const { service, gate } = await build({
      now: new Date('2026-01-01T09:59:59Z'),
    });

    await expect(service.purchase('a')).resolves.toEqual({
      status: ResultStatus.Rejected,
      reason: RejectionReason.Upcoming,
    });
    expect(gate.tickets).toBe(5);
  });

  it('rejects after the window closes', async () => {
    const { service } = await build({ now: new Date('2026-01-01T11:00:00Z') });

    await expect(service.purchase('a')).resolves.toEqual({
      status: ResultStatus.Rejected,
      reason: RejectionReason.Ended,
    });
  });

  it('creates an order and consumes a ticket and a unit', async () => {
    const { service, gate, sales, allocations } = await build();

    await expect(service.purchase('a')).resolves.toEqual({
      status: ResultStatus.Success,
      orderId: 1,
    });
    expect(gate.tickets).toBe(4);
    expect(sales.stock).toBe(4);
    expect(allocations.units.get('a')).toBe(1);
  });

  it('rejects a repeat buyer at the gate when the limit is 1', async () => {
    const { service, sales } = await build();
    await service.purchase('a');

    await expect(service.purchase('a')).resolves.toEqual(limitReached);
    expect(sales.stock).toBe(4);
  });

  it('allows up to the configured units per user', async () => {
    const { service } = await build({ maxPerUser: 2 });

    await expect(service.purchase('a')).resolves.toMatchObject({
      status: ResultStatus.Success,
    });
    await expect(service.purchase('a')).resolves.toMatchObject({
      status: ResultStatus.Success,
    });
    await expect(service.purchase('a')).resolves.toEqual(limitReached);
  });

  it('reports sold_out once tickets are gone', async () => {
    const { service } = await build({ gateTickets: 1 });
    await service.purchase('a');

    await expect(service.purchase('b')).resolves.toEqual(soldOut);
  });

  it('bypasses the gate and still enforces rules when the gate is down', async () => {
    const { service, gate } = await build({ dbStock: 1 });
    gate.failWith = new Error('connection refused');

    await expect(service.purchase('a')).resolves.toMatchObject({
      status: ResultStatus.Success,
    });
    await expect(service.purchase('a')).resolves.toEqual(limitReached);
    await expect(service.purchase('b')).resolves.toEqual(soldOut);
  });

  it('rolls back the allocation and order when stock is exhausted in the database', async () => {
    const { service, allocations, orders } = await build({ dbStock: 0 });

    await expect(service.purchase('a')).resolves.toEqual(soldOut);
    expect(allocations.units.get('a') ?? 0).toBe(0);
    expect(orders.orders).toHaveLength(0);
  });

  it('releases the ticket and reports 503 when the transaction fails', async () => {
    const { service, gate, allocations } = await build();
    allocations.failWith = new Error('pool exhausted');

    await expect(service.purchase('a')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(gate.tickets).toBe(5);
    expect(gate.units.has('a')).toBe(false);
  });

  it('releases the ticket when the database already has the user at the limit', async () => {
    const { service, gate, allocations } = await build();
    allocations.units.set('a', 1);

    await expect(service.purchase('a')).resolves.toEqual(limitReached);
    expect(gate.tickets).toBe(5);
  });

  it('keeps the ticket consumed when database stock is exhausted', async () => {
    const { service, gate } = await build({ dbStock: 0 });

    await expect(service.purchase('a')).resolves.toEqual(soldOut);
    expect(gate.tickets).toBe(4);
  });
});

describe('SaleService.getUserPurchases', () => {
  it('reports not purchased for an unknown user', async () => {
    const { service } = await build();

    await expect(service.getUserPurchases('nobody')).resolves.toEqual({
      purchased: false,
      unitsUsed: 0,
      maxPerUser: 1,
      orders: [],
    });
  });

  it('returns every order after purchases', async () => {
    const { service } = await build({ maxPerUser: 2 });
    await service.purchase('a');
    await service.purchase('a');

    await expect(service.getUserPurchases('a')).resolves.toEqual({
      purchased: true,
      unitsUsed: 2,
      maxPerUser: 2,
      orders: [
        {
          orderId: 1,
          priceCents: 1000,
          purchasedAt: '2026-01-01T10:30:00.000Z',
        },
        {
          orderId: 2,
          priceCents: 1000,
          purchasedAt: '2026-01-01T10:30:00.000Z',
        },
      ],
    });
  });
});
