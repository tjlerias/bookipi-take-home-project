import { QueryResult, QueryResultRow } from 'pg';

export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>>;
}

export interface Transaction extends Queryable {
  rollback(): void;
}

export abstract class TransactionRunner {
  abstract run<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
}
