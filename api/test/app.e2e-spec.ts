import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PG_POOL } from '../src/core/database/database.providers';
import { CurrentSaleService } from '../src/modules/sale/current-sale.service';
import { AdmissionGate } from '../src/modules/sale/interfaces/admission-gate.interface';
import { SaleRepository } from '../src/modules/sale/interfaces/sale-repository.interface';

describe('API (e2e)', () => {
  let app: NestFastifyApplication;
  let saleId: string;
  let productId: string;
  const users: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const sale = app.get(CurrentSaleService).getSale();
    saleId = sale.id;
    productId = sale.item.productId;
  });

  afterAll(async () => {
    const pool = app.get<Pool>(PG_POOL);
    for (const user of users) {
      const deleted = await pool.query(
        `DELETE FROM orders
         WHERE sale_id = $1
           AND user_id = $2`,
        [saleId, user],
      );
      await pool.query(
        `DELETE FROM sale_allocations
         WHERE sale_id = $1
           AND user_id = $2`,
        [saleId, user],
      );
      await pool.query(
        `UPDATE sale_items
         SET stock = stock + $2
         WHERE sale_id = $1`,
        [saleId, deleted.rowCount ?? 0],
      );
    }
    const gate = app.get(AdmissionGate);
    await gate.reset(saleId, productId);
    await gate.seed(
      saleId,
      productId,
      await app.get(SaleRepository).remainingStock(saleId, productId),
    );
    await app.close();
  });

  function newUser(): string {
    const user = `e2e-${randomUUID()}@example.com`;
    users.push(user);
    return user;
  }

  function buy(userId: string) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/sale/purchase',
      payload: { userId },
    });
  }

  it('GET /api/health', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('GET /api/v1/sale returns the sale and its item', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/sale' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(saleId);
    expect(['upcoming', 'active', 'sold_out', 'ended']).toContain(body.status);
    expect(new Date(body.serverTime).toISOString()).toBe(body.serverTime);
    expect(body.item).toMatchObject({
      productId,
      priceCents: expect.any(Number),
      salePriceCents: expect.any(Number),
      maxPerUser: expect.any(Number),
      remainingStock: expect.any(Number),
    });
  });

  it('POST /api/v1/sale/purchase validates the body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sale/purchase',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/sale/purchase succeeds once and conflicts on repeat', async () => {
    const userId = newUser();

    const first = await buy(userId);
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ result: 'success' });

    const second = await buy(userId.toUpperCase());
    expect(second.statusCode).toBe(409);
    expect(second.json()).toEqual({
      result: 'rejected',
      reason: 'limit_reached',
    });
  });

  it('a lease that never became an order expires on its own', async () => {
    const userId = newUser();
    const gate = app.get(AdmissionGate);
    const now = new Date();
    const before = await gate.remainingStock(saleId, productId, now);

    await gate.admit({
      saleId,
      productId,
      userId,
      maxPerUser: 1,
      now: new Date(now.getTime() - 120_000),
    });

    expect(await gate.remainingStock(saleId, productId, now)).toBe(before);
  });

  it('GET /api/v1/sale/purchase/:userId reflects the purchase', async () => {
    const userId = newUser();
    await buy(userId);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/sale/purchase/${encodeURIComponent(userId)}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      purchased: true,
      orders: [{ priceCents: expect.any(Number) }],
    });

    const unknown = await app.inject({
      method: 'GET',
      url: '/api/v1/sale/purchase/nobody@example.com',
    });
    expect(unknown.json()).toMatchObject({ purchased: false, orders: [] });
  });
});
