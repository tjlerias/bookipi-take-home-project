import { Client } from 'pg';
import { loadConfig } from './core/config/configuration';

async function seed(): Promise<void> {
  const { databaseUrl, sale } = loadConfig();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const result = await client.query(
      'INSERT INTO inventory (sale_id, stock) VALUES ($1, $2) ON CONFLICT (sale_id) DO NOTHING',
      [sale.id, sale.stock],
    );
    if (result.rowCount === 1) {
      console.log(`seeded sale "${sale.id}" with stock ${sale.stock}`);
    } else {
      console.log(`sale "${sale.id}" already seeded, left unchanged`);
    }
  } finally {
    await client.end();
  }
}

seed().catch((err: unknown) => {
  console.error('seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
