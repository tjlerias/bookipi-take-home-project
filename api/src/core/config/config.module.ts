import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadConfig } from './configuration';

export const APP_CONFIG = Symbol('APP_CONFIG');

@Module({
  imports: [ConfigModule.forRoot()],
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
