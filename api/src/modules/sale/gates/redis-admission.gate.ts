import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../core/redis/redis.providers';
import {
  AdmissionGate,
  AdmissionResult,
  AdmitRequest,
} from '../interfaces/admission-gate.interface';
import { holdersKey, ticketsKey, unitsKey } from './redis-admission.keys';
import { ADMIT_SCRIPT, RELEASE_SCRIPT } from './redis-admission.scripts';

interface GateCommands {
  admitUser(
    ticketsKey: string,
    unitsKey: string,
    holdersKey: string,
    userId: string,
    nowMs: string,
    maxPerUser: string,
  ): Promise<AdmissionResult>;

  releaseUser(
    ticketsKey: string,
    unitsKey: string,
    holdersKey: string,
    userId: string,
  ): Promise<number>;
}

@Injectable()
export class RedisAdmissionGate implements AdmissionGate {
  private readonly redisClient: Redis & GateCommands;

  constructor(@Inject(REDIS_CLIENT) redisClient: Redis) {
    redisClient.defineCommand('admitUser', {
      numberOfKeys: 3,
      lua: ADMIT_SCRIPT,
    });

    redisClient.defineCommand('releaseUser', {
      numberOfKeys: 3,
      lua: RELEASE_SCRIPT,
    });

    this.redisClient = redisClient as Redis & GateCommands;
  }

  async seed(saleId: string, productId: string, stock: number): Promise<void> {
    await this.redisClient.set(ticketsKey(saleId, productId), stock, 'NX');
  }

  admit({ saleId, productId, userId, maxPerUser, now }: AdmitRequest) {
    return this.redisClient.admitUser(
      ticketsKey(saleId, productId),
      unitsKey(saleId, productId),
      holdersKey(saleId, productId),
      userId,
      String(now.getTime()),
      String(maxPerUser),
    );
  }

  async release(
    saleId: string,
    productId: string,
    userId: string,
  ): Promise<boolean> {
    const released = await this.redisClient.releaseUser(
      ticketsKey(saleId, productId),
      unitsKey(saleId, productId),
      holdersKey(saleId, productId),
      userId,
    );

    return released === 1;
  }

  async remainingTickets(
    saleId: string,
    productId: string,
  ): Promise<number | null> {
    const value = await this.redisClient.get(ticketsKey(saleId, productId));

    return value === null ? null : Number(value);
  }

  async reset(saleId: string, productId: string): Promise<void> {
    await this.redisClient.del(
      ticketsKey(saleId, productId),
      unitsKey(saleId, productId),
      holdersKey(saleId, productId),
    );
  }
}
