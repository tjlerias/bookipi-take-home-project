import Redis from 'ioredis';
import { Client } from 'pg';
import { loadConfig } from './core/config/configuration';
import { RedisAdmissionGate } from './modules/sale/gates/redis-admission.gate';

async function reset(): Promise<void> {
  const { databaseUrl, redisUrl, sale } = loadConfig();
  const db = new Client({ connectionString: databaseUrl });
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  await db.connect();

  try {
    await db.query('BEGIN');
    const deleted = await db.query('DELETE FROM orders WHERE sale_id = $1', [
      sale.id,
    ]);
    await db.query(
      `INSERT INTO inventory (sale_id, stock) VALUES ($1, $2)
       ON CONFLICT (sale_id) DO UPDATE SET stock = EXCLUDED.stock`,
      [sale.id, sale.stock],
    );
    await db.query('COMMIT');
    console.log(
      `sale "${sale.id}": stock set to ${sale.stock}, ${deleted.rowCount ?? 0} orders deleted`,
    );

    const gate = new RedisAdmissionGate(redis);
    await gate.reset(sale.id);
    await gate.seed(sale.id, sale.stock);
    console.log(`sale "${sale.id}": redis tickets reset to ${sale.stock}`);
  } catch (err) {
    await db.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    await db.end();
    await redis.quit();
  }
}

reset().catch((err: unknown) => {
  console.error('reset failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
