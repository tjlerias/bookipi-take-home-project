import { Test } from '@nestjs/testing';
import { Clock } from '../../core/clock/interfaces/clock.interface';
import { APP_CONFIG } from '../../core/config/config.module';
import { AppConfig } from '../../core/config/interfaces/app-config.interface';
import { OrderRepository } from './interfaces/order-repository.interface';
import { SaleService } from './sale.service';

class MemoryOrderRepository implements OrderRepository {
  constructor(private readonly stock: number) {}

  async remainingStock(): Promise<number> {
    return this.stock;
  }
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

async function buildService(now: Date, stock: number): Promise<SaleService> {
  const clock: Clock = { now: () => now };
  const moduleRef = await Test.createTestingModule({
    providers: [
      SaleService,
      { provide: APP_CONFIG, useValue: config },
      { provide: Clock, useValue: clock },
      {
        provide: OrderRepository,
        useValue: new MemoryOrderRepository(stock),
      },
    ],
  }).compile();
  return moduleRef.get(SaleService);
}

describe('SaleService.status', () => {
  it('returns the window, server time, and remaining stock', async () => {
    const now = new Date('2026-01-01T10:30:00Z');
    const service = await buildService(now, 5);

    await expect(service.status()).resolves.toEqual({
      status: 'active',
      startsAt: '2026-01-01T10:00:00.000Z',
      endsAt: '2026-01-01T11:00:00.000Z',
      serverTime: '2026-01-01T10:30:00.000Z',
      remaining: 5,
    });
  });

  it('reports sold_out when the repository has no stock', async () => {
    const service = await buildService(new Date('2026-01-01T10:30:00Z'), 0);

    await expect(service.status()).resolves.toMatchObject({
      status: 'sold_out',
      remaining: 0,
    });
  });
});
