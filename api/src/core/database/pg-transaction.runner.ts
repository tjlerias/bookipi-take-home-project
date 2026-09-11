import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { PG_POOL } from './database.providers';
import { Transaction, TransactionRunner } from './transaction';

class PgTransaction implements Transaction {
  rolledBack = false;

  constructor(private readonly postgresClient: PoolClient) {}

  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>> {
    return this.postgresClient.query<R>(text, values);
  }

  rollback(): void {
    this.rolledBack = true;
  }
}

@Injectable()
export class PgTransactionRunner implements TransactionRunner {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    const postgresClient = await this.pool.connect();
    const tx = new PgTransaction(postgresClient);

    try {
      await postgresClient.query('BEGIN');

      const result = await work(tx);

      await postgresClient.query(tx.rolledBack ? 'ROLLBACK' : 'COMMIT');

      return result;
    } catch (err) {
      await postgresClient.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      postgresClient.release();
    }
  }
}
