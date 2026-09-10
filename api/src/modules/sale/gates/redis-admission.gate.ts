import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../core/redis/redis.providers';
import {
  AdmissionGate,
  AdmissionResult,
} from '../interfaces/admission-gate.interface';
import { ADMIT_SCRIPT, RELEASE_SCRIPT } from './redis-admission.scripts';
import { holdersKey, ticketsKey } from './redis-admission.keys';

interface GateCommands {
  admitUser(
    ticketsKey: string,
    holdersKey: string,
    userId: string,
    nowMs: string,
  ): Promise<AdmissionResult>;

  releaseUser(
    ticketsKey: string,
    holdersKey: string,
    userId: string,
  ): Promise<number>;
}

@Injectable()
export class RedisAdmissionGate implements AdmissionGate {
  private readonly client: Redis & GateCommands;

  constructor(@Inject(REDIS_CLIENT) client: Redis) {
    client.defineCommand('admitUser', {
      numberOfKeys: 2,
      lua: ADMIT_SCRIPT,
    });

    client.defineCommand('releaseUser', {
      numberOfKeys: 2,
      lua: RELEASE_SCRIPT,
    });

    this.client = client as Redis & GateCommands;
  }

  async seed(saleId: string, stock: number): Promise<void> {
    await this.client.set(ticketsKey(saleId), stock, 'NX');
  }

  admit(saleId: string, userId: string, now: Date): Promise<AdmissionResult> {
    return this.client.admitUser(
      ticketsKey(saleId),
      holdersKey(saleId),
      userId,
      String(now.getTime()),
    );
  }

  async release(saleId: string, userId: string): Promise<boolean> {
    const released = await this.client.releaseUser(
      ticketsKey(saleId),
      holdersKey(saleId),
      userId,
    );

    return released === 1;
  }

  async remaining(saleId: string): Promise<number | null> {
    const value = await this.client.get(ticketsKey(saleId));

    return value === null ? null : Number(value);
  }

  async reset(saleId: string): Promise<void> {
    await this.client.del(ticketsKey(saleId), holdersKey(saleId));
  }
}
