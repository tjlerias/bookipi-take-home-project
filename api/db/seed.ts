import { Client } from 'pg';
import { loadConfig, loadSaleWindow } from '../src/core/config/configuration';
import { PRODUCT, SALE, SALE_ITEM } from './seed-data';

async function seed(): Promise<void> {
  const { databaseUrl } = loadConfig();
  const window = loadSaleWindow();
  const postgresClient = new Client({ connectionString: databaseUrl });
  await postgresClient.connect();

  try {
    await postgresClient.query('BEGIN');

    const existing = await postgresClient.query(
      `SELECT 1
       FROM sales
       WHERE id = $1`,
      [SALE.id],
    );
    const inserted = existing.rowCount === 0;

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
      `sale "${SALE.id}": window ${window.startsAt.toISOString()} to ${window.endsAt.toISOString()}`,
    );

    console.log(
      inserted
        ? `sale "${SALE.id}": created with stock ${SALE_ITEM.stock}`
        : `sale "${SALE.id}": updated, stock left unchanged`,
    );
  } catch (err) {
    await postgresClient.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    await postgresClient.end();
  }
}

seed().catch((err: unknown) => {
  console.error('seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
