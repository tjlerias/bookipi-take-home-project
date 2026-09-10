import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from 'pg';
import { loadConfig } from './core/config/configuration';

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

async function migrate(): Promise<void> {
  const config = loadConfig();
  const client = new Client({ connectionString: config.databaseUrl });
  await client.connect();

  try {
    const files = (await readdir(MIGRATIONS_DIR))
      .filter((name) => name.endsWith('.sql'))
      .sort();

    await client.query('BEGIN');
    for (const file of files) {
      await client.query(await readFile(join(MIGRATIONS_DIR, file), 'utf8'));
      console.log(`applied ${file}`);
    }
    await client.query(
      'INSERT INTO inventory (sale_id, stock) VALUES ($1, $2) ON CONFLICT (sale_id) DO NOTHING',
      [config.sale.id, config.sale.stock],
    );
    await client.query('COMMIT');
    console.log(
      `seeded sale "${config.sale.id}" with stock ${config.sale.stock}`,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

migrate().catch((err: unknown) => {
  console.error('migration failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
