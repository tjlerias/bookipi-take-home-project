import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from 'pg';
import { loadConfig } from '../src/core/config/configuration';

const MIGRATIONS_DIR = join(__dirname, 'migrations');

async function migrate(): Promise<void> {
  const { databaseUrl } = loadConfig();
  const postgresClient = new Client({ connectionString: databaseUrl });

  await postgresClient.connect();

  try {
    const files = (await readdir(MIGRATIONS_DIR))
      .filter((name) => name.endsWith('.sql'))
      .sort();

    await postgresClient.query('BEGIN');

    for (const file of files) {
      await postgresClient.query(
        await readFile(join(MIGRATIONS_DIR, file), 'utf8'),
      );
      console.log(`applied ${file}`);
    }

    await postgresClient.query('COMMIT');
  } catch (err) {
    await postgresClient.query('ROLLBACK');
    throw err;
  } finally {
    await postgresClient.end();
  }
}

migrate().catch((err: unknown) => {
  console.error('migration failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
