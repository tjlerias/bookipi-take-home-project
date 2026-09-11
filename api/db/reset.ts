import Redis from 'ioredis';
import { Client } from 'pg';
import { loadConfig, loadSaleWindow } from '../src/core/config/configuration';
import { RedisAdmissionGate } from '../src/modules/sale/gates/redis-admission.gate';
import { PRODUCT, SALE, SALE_ITEM } from './seed-data';

async function reset(): Promise<void> {
  const { databaseUrl, redisUrl } = loadConfig();
  const window = loadSaleWindow();
  const postgresClient = new Client({ connectionString: databaseUrl });
  const redisClient = new Redis(redisUrl, { maxRetriesPerRequest: 1 });

  await postgresClient.connect();

  try {
    await postgresClient.query('BEGIN');

    const deleted = await postgresClient.query(
      `DELETE FROM orders
       WHERE sale_id = $1`,
      [SALE.id],
    );

    await postgresClient.query(
      `DELETE FROM sale_allocations
       WHERE sale_id = $1`,
      [SALE.id],
    );

    await postgresClient.query(
      `INSERT INTO products (id, name, price_cents)
       VALUES ($1, $2, $3)
       ON CONFLICT (id)
       DO UPDATE
       SET name = EXCLUDED.name,
           price_cents = EXCLUDED.price_cents`,
      [PRODUCT.id, PRODUCT.name, PRODUCT.priceCents],
    );

    await postgresClient.query(
      `INSERT INTO sales (id, name, starts_at, ends_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id)
       DO UPDATE
       SET name = EXCLUDED.name,
           starts_at = EXCLUDED.starts_at,
           ends_at = EXCLUDED.ends_at`,
      [SALE.id, SALE.name, window.startsAt, window.endsAt],
    );

    await postgresClient.query(
      `INSERT INTO sale_items (sale_id, product_id, sale_price_cents, stock, max_per_user)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (sale_id, product_id)
       DO UPDATE
       SET sale_price_cents = EXCLUDED.sale_price_cents,
           stock = EXCLUDED.stock,
           max_per_user = EXCLUDED.max_per_user`,
      [
        SALE_ITEM.saleId,
        SALE_ITEM.productId,
        SALE_ITEM.salePriceCents,
        SALE_ITEM.stock,
        SALE_ITEM.maxPerUser,
      ],
    );

    await postgresClient.query('COMMIT');

    console.log(
      `sale "${SALE.id}": ${deleted.rowCount ?? 0} orders deleted, stock reset to ${SALE_ITEM.stock}`,
    );

    const gate = new RedisAdmissionGate(redisClient);
    await gate.reset(SALE_ITEM.saleId, SALE_ITEM.productId);
    await gate.seed(SALE_ITEM.saleId, SALE_ITEM.productId, SALE_ITEM.stock);
    console.log(`sale "${SALE.id}": redis tickets reset to ${SALE_ITEM.stock}`);
  } catch (err) {
    await postgresClient.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    await postgresClient.end();
    await redisClient.quit();
  }
}

reset().catch((err: unknown) => {
  console.error('reset failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
