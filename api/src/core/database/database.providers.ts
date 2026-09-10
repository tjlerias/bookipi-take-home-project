import { Inject, Injectable, OnModuleDestroy, Provider } from '@nestjs/common';
import { Pool } from 'pg';
import { APP_CONFIG } from '../config/config.module';
import { AppConfig } from '../config/interfaces/app-config.interface';

export const PG_POOL = Symbol('PG_POOL');

@Injectable()
export class PoolLifecycle implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

export const databaseProviders: Provider[] = [
  {
    provide: PG_POOL,
    useFactory: (config: AppConfig) =>
      new Pool({ connectionString: config.databaseUrl, max: 10 }),
    inject: [APP_CONFIG],
  },
  PoolLifecycle,
];
