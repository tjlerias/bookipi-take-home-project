import { Module } from '@nestjs/common';
import { REDIS_CLIENT, redisProviders } from './redis.providers';

@Module({
  providers: redisProviders,
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
