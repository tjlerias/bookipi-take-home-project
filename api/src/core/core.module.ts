import { Global, Module } from '@nestjs/common';
import { ClockModule } from './clock/clock.module';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';

@Global()
@Module({
  imports: [AppConfigModule, ClockModule, DatabaseModule, RedisModule],
  exports: [AppConfigModule, ClockModule, DatabaseModule, RedisModule],
})
export class CoreModule {}
