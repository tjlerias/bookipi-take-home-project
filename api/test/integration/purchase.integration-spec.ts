import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { loadConfig } from '../../src/core/config/configuration';
import { PgTransactionRunner } from '../../src/core/database/pg-transaction.runner';
import { PostgresOrderRepository } from '../../src/modules/orders/repositories/postgres-order.repository';
import { CurrentSaleService } from '../../src/modules/sale/current-sale.service';
import { RejectionReason } from '../../src/modules/sale/enums/rejection-reason.enum';
import { ResultStatus } from '../../src/modules/sale/enums/result-status.enum';
import { AdmissionGate } from '../../src/modules/sale/interfaces/admission-gate.interface';
import { PurchaseResult } from '../../src/modules/sale/interfaces/purchase-result.interface';
import { SaleDetails } from '../../src/modules/sale/interfaces/sale-details.interface';
import { PostgresSaleAllocationRepository } from '../../src/modules/sale/repositories/postgres-sale-allocation.repository';
import { PostgresSaleRepository } from '../../src/modules/sale/repositories/postgres-sale.repository';
import { SaleService } from '../../src/modules/sale/sale.service';

// A gate that always throws, so the service takes the fail-open path and Postgres alone enforces the rules.
class DownGate implements AdmissionGate {
  async seed(): Promise<void> {}
  async admit(): Promise<never> {
    throw new Error('gate down');
  }
  async confirm(): Promise<void> {}
  async cancel(): Promise<void> {}
  async remainingStock(): Promise<number | null> {
    throw new Error('gate down');
  }
  async reset(): Promise<void> {}
}

describe('Purchase transaction against Postgres (integration)', () => {
  const pool = new Pool({
    connectionString: loadConfig().databaseUrl,
    max: 10,
  });
  const sales = new PostgresSaleRepository(pool);
  const orders = new PostgresOrderRepository(pool);
  const PRODUCT = 'it-product';
  let saleId: string;

  function buildService(maxPerUser: number): SaleService {
    const sale: SaleDetails = {
      id: saleId,
      name: 'Integration Sale',
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 3_600_000),
      item: {
        productId: PRODUCT,
        name: 'P',
        priceCents: 500,
        salePriceCents: 250,
        maxPerUser,
      },
    };

    return new SaleService(
      new DownGate(),
      { now: () => new Date() },
      { getSale: () => sale } as CurrentSaleService,
      new PostgresSaleAllocationRepository(),
      sales,
      new PgTransactionRunner(pool),
      orders,
    );
  }

  async function seedSale(stock: number, maxPerUser = 1): Promise<void> {
    await pool.query(
      `INSERT INTO sales (id, name, starts_at, ends_at)
       VALUES ($1, $2, now() - interval '1 minute', now() + interval '1 hour')`,
      [saleId, 'Integration Sale'],
    );
    await pool.query(
      `INSERT INTO sale_items (sale_id, product_id, sale_price_cents, stock, max_per_user)
       VALUES ($1, $2, 250, $3, $4)`,
      [saleId, PRODUCT, stock, maxPerUser],
    );
  }

  const created = (r: PurchaseResult) => r.status === ResultStatus.Success;
  const rejectedWith = (reason: RejectionReason) => (r: PurchaseResult) =>
    r.status === ResultStatus.Rejected && r.reason === reason;

  beforeAll(async () => {
    await pool.query(
      `INSERT INTO products (id, name, price_cents)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [PRODUCT, 'Integration Product', 500],
    );
  });

  beforeEach(() => {
    saleId = `it-${randomUUID()}`;
  });

  afterEach(async () => {
    await pool.query('DELETE FROM orders WHERE sale_id = $1', [saleId]);
    await pool.query('DELETE FROM sale_allocations WHERE sale_id = $1', [
      saleId,
    ]);
    await pool.query('DELETE FROM sale_items WHERE sale_id = $1', [saleId]);
    await pool.query('DELETE FROM sales WHERE id = $1', [saleId]);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM products WHERE id = $1', [PRODUCT]);
    await pool.end();
  });

  it('creates an order with the sale price and decrements stock', async () => {
    await seedSale(2);
    const service = buildService(1);

    const result = await service.purchase('a');

    expect(result.status).toBe(ResultStatus.Success);
    await expect(sales.remainingStock(saleId, PRODUCT)).resolves.toBe(1);
    const found = await orders.findByUser(saleId, 'a');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ saleId, userId: 'a', priceCents: 250 });
  });

  it('rejects a repeat buyer at the limit without touching stock', async () => {
    await seedSale(2);
    const service = buildService(1);
    await service.purchase('a');

    await expect(service.purchase('a')).resolves.toEqual({
      status: ResultStatus.Rejected,
      reason: RejectionReason.LimitReached,
    });
    await expect(sales.remainingStock(saleId, PRODUCT)).resolves.toBe(1);
  });

  it('allows up to maxPerUser units and records each order', async () => {
    await seedSale(5, 2);
    const service = buildService(2);

    expect(created(await service.purchase('a'))).toBe(true);
    expect(created(await service.purchase('a'))).toBe(true);
    await expect(service.purchase('a')).resolves.toMatchObject({
      reason: RejectionReason.LimitReached,
    });
    await expect(orders.findByUser(saleId, 'a')).resolves.toHaveLength(2);
  });

  it('rolls back the allocation and order when stock is exhausted', async () => {
    await seedSale(1);
    const service = buildService(1);
    await service.purchase('a');

    await expect(service.purchase('b')).resolves.toMatchObject({
      reason: RejectionReason.SoldOut,
    });
    await expect(orders.findByUser(saleId, 'b')).resolves.toHaveLength(0);
    const allocations = await pool.query(
      `SELECT 1
       FROM sale_allocations
       WHERE sale_id = $1
         AND product_id = $2
         AND user_id = $3`,
      [saleId, PRODUCT, 'b'],
    );
    expect(allocations.rowCount).toBe(0);
    await expect(sales.remainingStock(saleId, PRODUCT)).resolves.toBe(0);
  });

  it('never oversells under concurrent purchases', async () => {
    const stock = 5;
    const attempts = 200;
    await seedSale(stock);
    const service = buildService(1);

    const results = await Promise.all(
      Array.from({ length: attempts }, (_, i) => service.purchase(`user-${i}`)),
    );

    expect(results.filter(created)).toHaveLength(stock);
    expect(results.filter(rejectedWith(RejectionReason.SoldOut))).toHaveLength(
      attempts - stock,
    );
    await expect(sales.remainingStock(saleId, PRODUCT)).resolves.toBe(0);
    const rows = await pool.query<{ count: string }>(
      `SELECT count(*)
       FROM orders
       WHERE sale_id = $1`,
      [saleId],
    );
    expect(Number(rows.rows[0].count)).toBe(stock);
  });

  it('never gives one user more than the limit under concurrent duplicates', async () => {
    await seedSale(50, 3);
    const service = buildService(3);

    const results = await Promise.all(
      Array.from({ length: 50 }, () => service.purchase('same')),
    );

    expect(results.filter(created)).toHaveLength(3);
    await expect(orders.findByUser(saleId, 'same')).resolves.toHaveLength(3);
    await expect(sales.remainingStock(saleId, PRODUCT)).resolves.toBe(47);
  });
});
