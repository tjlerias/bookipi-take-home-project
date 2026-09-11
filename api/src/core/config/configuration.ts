import { AppConfig, SaleWindow } from './interfaces/app-config.interface';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const problems: string[] = [];

  const port = parseInteger(env.PORT, 3000, 'PORT', problems);
  const databaseUrl = env.DATABASE_URL ?? buildDatabaseUrl(env, problems);
  const redisUrl = env.REDIS_URL ?? 'redis://localhost:6379';

  if (problems.length > 0) {
    throw new Error(`Invalid configuration:\n  - ${problems.join('\n  - ')}`);
  }

  return Object.freeze({
    port,
    databaseUrl,
    redisUrl,
    rateLimitEnabled: parseBoolean(env.RATE_LIMIT_ENABLED, true),
  });
}

export function loadSaleWindow(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): SaleWindow {
  const problems: string[] = [];
  const startsAt = parseDate(env.SALE_START, now, 'SALE_START', problems);
  const endsAt = parseDate(
    env.SALE_END,
    new Date(now.getTime() + ONE_DAY_MS),
    'SALE_END',
    problems,
  );

  if (endsAt.getTime() <= startsAt.getTime()) {
    problems.push('SALE_END must be after SALE_START');
  }

  if (problems.length > 0) {
    throw new Error(`Invalid sale window:\n  - ${problems.join('\n  - ')}`);
  }

  return { startsAt, endsAt };
}

function buildDatabaseUrl(env: NodeJS.ProcessEnv, problems: string[]): string {
  const host = env.POSTGRES_HOST ?? 'localhost';
  const port = parseInteger(env.POSTGRES_PORT, 5432, 'POSTGRES_PORT', problems);
  const user = env.POSTGRES_USER;
  const password = env.POSTGRES_PASSWORD;
  const database = env.POSTGRES_DB;

  for (const [name, value] of [
    ['POSTGRES_USER', user],
    ['POSTGRES_PASSWORD', password],
    ['POSTGRES_DB', database],
  ] as const) {
    if (value === undefined || value === '') {
      problems.push(`${name} is required when DATABASE_URL is not set`);
    }
  }

  return `postgres://${encodeURIComponent(user ?? '')}:${encodeURIComponent(password ?? '')}@${host}:${port}/${database ?? ''}`;
}

function parseInteger(
  raw: string | undefined,
  fallback: number,
  name: string,
  problems: string[],
): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isInteger(value)) {
    problems.push(`${name} must be an integer, got "${raw}"`);
    return fallback;
  }

  return value;
}

function parseDate(
  raw: string | undefined,
  fallback: Date,
  name: string,
  problems: string[],
): Date {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) {
    problems.push(`${name} must be an ISO 8601 date, got "${raw}"`);
    return fallback;
  }

  return value;
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  return !['false', '0', 'no', 'off'].includes(raw.trim().toLowerCase());
}
