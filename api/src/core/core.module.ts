import { Global, Module } from '@nestjs/common';
import { ClockModule } from './clock/clock.module';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';

@Global()
@Module({
  imports: [AppConfigModule, ClockModule, DatabaseModule],
  exports: [AppConfigModule, ClockModule, DatabaseModule],
})
export class CoreModule {}
