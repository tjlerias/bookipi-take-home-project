import { Module } from '@nestjs/common';
import { databaseProviders, PG_POOL } from './database.providers';

@Module({
  providers: databaseProviders,
  exports: [PG_POOL],
})
export class DatabaseModule {}
