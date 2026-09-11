import { Module } from '@nestjs/common';
import { databaseProviders, PG_POOL } from './database.providers';
import { PgTransactionRunner } from './pg-transaction.runner';
import { TransactionRunner } from './transaction';

@Module({
  providers: [
    ...databaseProviders,
    { provide: TransactionRunner, useClass: PgTransactionRunner },
  ],
  exports: [PG_POOL, TransactionRunner],
})
export class DatabaseModule {}
