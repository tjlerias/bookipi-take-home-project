import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../core/redis/redis.providers';
import {
  AdmissionGate,
  AdmissionResult,
  AdmitRequest,
} from '../interfaces/admission-gate.interface';
import { availableKey, leasesKey, unitsKey } from './redis-admission.keys';
import {
  ADMIT_SCRIPT,
  CONFIRM_SCRIPT,
  REMAINING_SCRIPT,
} from './redis-admission.scripts';

const LEASE_TTL_MS = 10_000;

interface GateCommands {
  admitUser(
    availableKey: string,
    leasesKey: string,
    unitsKey: string,
    userId: string,
    nowMs: string,
    expiresAtMs: string,
    maxPerUser: string,
  ): Promise<AdmissionResult>;

  confirmUser(
    availableKey: string,
    leasesKey: string,
    unitsKey: string,
    userId: string,
  ): Promise<number>;

  remainingStock(
    availableKey: string,
    leasesKey: string,
    nowMs: string,
  ): Promise<number | null>;
}

@Injectable()
export class RedisAdmissionGate implements AdmissionGate {
  private readonly redisClient: Redis & GateCommands;

  constructor(@Inject(REDIS_CLIENT) redisClient: Redis) {
    redisClient.defineCommand('admitUser', {
      numberOfKeys: 3,
      lua: ADMIT_SCRIPT,
    });

    redisClient.defineCommand('confirmUser', {
      numberOfKeys: 3,
      lua: CONFIRM_SCRIPT,
    });

    redisClient.defineCommand('remainingStock', {
      numberOfKeys: 2,
      lua: REMAINING_SCRIPT,
    });

    this.redisClient = redisClient as Redis & GateCommands;
  }

  async seed(saleId: string, productId: string, stock: number): Promise<void> {
    await this.redisClient.set(availableKey(saleId, productId), stock, 'NX');
  }

  admit({ saleId, productId, userId, maxPerUser, now }: AdmitRequest) {
    return this.redisClient.admitUser(
      availableKey(saleId, productId),
      leasesKey(saleId, productId),
      unitsKey(saleId, productId),
      userId,
      String(now.getTime()),
      String(now.getTime() + LEASE_TTL_MS),
      String(maxPerUser),
    );
  }

  async confirm(
    saleId: string,
    productId: string,
    userId: string,
  ): Promise<void> {
    await this.redisClient.confirmUser(
      availableKey(saleId, productId),
      leasesKey(saleId, productId),
      unitsKey(saleId, productId),
      userId,
    );
  }

  async cancel(
    saleId: string,
    productId: string,
    userId: string,
  ): Promise<void> {
    await this.redisClient.zrem(leasesKey(saleId, productId), userId);
  }

  async remainingStock(
    saleId: string,
    productId: string,
    now: Date,
  ): Promise<number | null> {
    const value = await this.redisClient.remainingStock(
      availableKey(saleId, productId),
      leasesKey(saleId, productId),
      String(now.getTime()),
    );
    return value === null ? null : Number(value);
  }

  async reset(saleId: string, productId: string): Promise<void> {
    await this.redisClient.del(
      availableKey(saleId, productId),
      leasesKey(saleId, productId),
      unitsKey(saleId, productId),
    );
  }
}
