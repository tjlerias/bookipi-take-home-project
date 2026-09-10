import { Test } from '@nestjs/testing';
import { Clock } from '../../core/clock/interfaces/clock.interface';
import { APP_CONFIG } from '../../core/config/config.module';
import { AppConfig } from '../../core/config/interfaces/app-config.interface';
import {
  AdmissionGate,
  AdmissionResult,
} from './interfaces/admission-gate.interface';
import { OrderRepository } from './interfaces/order-repository.interface';
import { SaleService } from './sale.service';

class MemoryOrderRepository implements OrderRepository {
  constructor(private readonly stock: number) {}

  async remainingStock(): Promise<number> {
    return this.stock;
  }
}

class FakeGate implements AdmissionGate {
  constructor(private readonly tickets: number | null | Error) {}

  async seed(): Promise<void> {}

  async admit(): Promise<AdmissionResult> {
    return 'admitted';
  }

  async release(): Promise<boolean> {
    return true;
  }

  async remaining(): Promise<number | null> {
    if (this.tickets instanceof Error) {
      throw this.tickets;
    }
    return this.tickets;
  }

  async reset(): Promise<void> {}
}

const config: AppConfig = {
  port: 0,
  databaseUrl: '',
  redisUrl: '',
  rateLimitEnabled: false,
  sale: {
    id: 'test',
    startsAt: new Date('2026-01-01T10:00:00Z'),
    endsAt: new Date('2026-01-01T11:00:00Z'),
    stock: 5,
  },
};

interface Deps {
  now?: Date;
  gateTickets?: number | null | Error;
  dbStock?: number;
}

async function buildService({
  now = new Date('2026-01-01T10:30:00Z'),
  gateTickets = 5,
  dbStock = 5,
}: Deps = {}): Promise<SaleService> {
  const clock: Clock = { now: () => now };
  const moduleRef = await Test.createTestingModule({
    providers: [
      SaleService,
      { provide: APP_CONFIG, useValue: config },
      { provide: Clock, useValue: clock },
      { provide: AdmissionGate, useValue: new FakeGate(gateTickets) },
      {
        provide: OrderRepository,
        useValue: new MemoryOrderRepository(dbStock),
      },
    ],
  }).compile();
  return moduleRef.get(SaleService);
}

describe('SaleService.status', () => {
  it('returns the window, server time, and remaining stock', async () => {
    const service = await buildService();

    await expect(service.status()).resolves.toEqual({
      status: 'active',
      startsAt: '2026-01-01T10:00:00.000Z',
      endsAt: '2026-01-01T11:00:00.000Z',
      serverTime: '2026-01-01T10:30:00.000Z',
      remaining: 5,
    });
  });

  it('prefers the gate ticket count over the database', async () => {
    const service = await buildService({ gateTickets: 2, dbStock: 5 });

    await expect(service.status()).resolves.toMatchObject({ remaining: 2 });
  });

  it('falls back to the database when the gate is unseeded', async () => {
    const service = await buildService({ gateTickets: null, dbStock: 3 });

    await expect(service.status()).resolves.toMatchObject({ remaining: 3 });
  });

  it('falls back to the database when the gate is unavailable', async () => {
    const service = await buildService({
      gateTickets: new Error('connection refused'),
      dbStock: 4,
    });

    await expect(service.status()).resolves.toMatchObject({ remaining: 4 });
  });

  it('reports sold_out when nothing remains', async () => {
    const service = await buildService({ gateTickets: 0 });

    await expect(service.status()).resolves.toMatchObject({
      status: 'sold_out',
      remaining: 0,
    });
  });
});
