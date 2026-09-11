import {
  Queryable,
  Transaction,
  TransactionRunner,
} from '../../src/core/database/transaction';

export class MemoryTransaction implements Transaction {
  readonly undo: Array<() => void> = [];
  rolledBack = false;

  query(): never {
    throw new Error('fakes do not run SQL');
  }

  rollback(): void {
    this.rolledBack = true;
  }
}

export class MemoryTransactionRunner implements TransactionRunner {
  async run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    const tx = new MemoryTransaction();
    try {
      const result = await work(tx);
      if (tx.rolledBack) {
        tx.undo.reverse().forEach((undo) => undo());
      }
      return result;
    } catch (err) {
      tx.undo.reverse().forEach((undo) => undo());
      throw err;
    }
  }
}

export function undoOf(tx: Queryable): Array<() => void> {
  return (tx as MemoryTransaction).undo;
}
