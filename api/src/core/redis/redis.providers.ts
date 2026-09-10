import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  Provider,
} from '@nestjs/common';
import Redis from 'ioredis';
import { APP_CONFIG } from '../config/config.module';
import { AppConfig } from '../config/interfaces/app-config.interface';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Injectable()
export class RedisLifecycle implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}

export const redisProviders: Provider[] = [
  {
    provide: REDIS_CLIENT,
    useFactory: (config: AppConfig) => {
      const logger = new Logger('Redis');
      const client = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
      });
      // Without a listener ioredis prints every connection error as an unhandled event.
      client.on('error', (err: Error) => logger.warn(err.message));
      return client;
    },
    inject: [APP_CONFIG],
  },
  RedisLifecycle,
];
