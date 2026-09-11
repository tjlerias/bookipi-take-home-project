import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { RejectionReason } from '../../src/modules/sale/enums/rejection-reason.enum';
import { ResultStatus } from '../../src/modules/sale/enums/result-status.enum';
import { RedisAdmissionGate } from '../../src/modules/sale/gates/redis-admission.gate';

describe('RedisAdmissionGate (integration)', () => {
  const redisClient = new Redis(
    process.env.REDIS_URL ?? 'redis://localhost:6379',
  );
  const gate = new RedisAdmissionGate(redisClient);
  const PRODUCT = 'sneaker';
  const T0 = new Date('2026-01-01T10:00:00Z');
  const LATER = new Date(T0.getTime() + 31_000);
  let saleId: string;

  const admit = (userId: string, maxPerUser = 1, now = T0) =>
    gate.admit({ saleId, productId: PRODUCT, userId, maxPerUser, now });
  const remaining = (now = T0) => gate.remainingStock(saleId, PRODUCT, now);

  beforeEach(() => {
    saleId = `it-${randomUUID()}`;
  });

  afterEach(() => gate.reset(saleId, PRODUCT));

  afterAll(() => redisClient.quit());

  it('reports null before seeding and the available count after', async () => {
    await expect(remaining()).resolves.toBeNull();
    await gate.seed(saleId, PRODUCT, 3);
    await expect(remaining()).resolves.toBe(3);
  });

  it('does not overwrite an existing count on re-seed', async () => {
    await gate.seed(saleId, PRODUCT, 3);
    await admit('a');
    await gate.confirm(saleId, PRODUCT, 'a');
    await gate.seed(saleId, PRODUCT, 3);
    await expect(remaining()).resolves.toBe(2);
  });

  it('admits distinct users until units run out, counting live leases', async () => {
    await gate.seed(saleId, PRODUCT, 2);

    await expect(admit('a')).resolves.toBe(ResultStatus.Success);
    await expect(admit('b')).resolves.toBe(ResultStatus.Success);
    await expect(admit('c')).resolves.toBe(RejectionReason.SoldOut);
    await expect(remaining()).resolves.toBe(0);
  });

  it('rejects a user who already holds a live lease', async () => {
    await gate.seed(saleId, PRODUCT, 2);

    await admit('a');
    await expect(admit('a')).resolves.toBe(RejectionReason.LimitReached);
    await expect(remaining()).resolves.toBe(1);
  });

  it('allows up to maxPerUser units, one confirmed lease at a time', async () => {
    await gate.seed(saleId, PRODUCT, 5);

    await expect(admit('a', 2)).resolves.toBe(ResultStatus.Success);
    await gate.confirm(saleId, PRODUCT, 'a');
    await expect(admit('a', 2)).resolves.toBe(ResultStatus.Success);
    await gate.confirm(saleId, PRODUCT, 'a');
    await expect(admit('a', 2)).resolves.toBe(RejectionReason.LimitReached);
    await expect(remaining()).resolves.toBe(3);
  });

  it('confirm consumes the unit and clears the lease', async () => {
    await gate.seed(saleId, PRODUCT, 2);
    await admit('a');

    await gate.confirm(saleId, PRODUCT, 'a');
    await expect(remaining()).resolves.toBe(1);
    await expect(admit('b')).resolves.toBe(ResultStatus.Success);
  });

  it('cancel frees the unit immediately', async () => {
    await gate.seed(saleId, PRODUCT, 1);
    await admit('a');
    await expect(admit('b')).resolves.toBe(RejectionReason.SoldOut);

    await gate.cancel(saleId, PRODUCT, 'a');
    await expect(admit('b')).resolves.toBe(ResultStatus.Success);
  });

  it('an unconfirmed lease expires and frees the unit on its own', async () => {
    await gate.seed(saleId, PRODUCT, 1);
    await admit('a');
    await expect(admit('b')).resolves.toBe(RejectionReason.SoldOut);
    await expect(remaining()).resolves.toBe(0);

    await expect(remaining(LATER)).resolves.toBe(1);
    await expect(admit('b', 1, LATER)).resolves.toBe(ResultStatus.Success);
  });

  it('never admits more users than units under concurrency', async () => {
    const units = 20;
    const attempts = 500;
    await gate.seed(saleId, PRODUCT, units);

    const results = await Promise.all(
      Array.from({ length: attempts }, (_, i) => admit(`user-${i}`)),
    );

    expect(results.filter((r) => r === ResultStatus.Success)).toHaveLength(
      units,
    );
    expect(results.filter((r) => r === RejectionReason.SoldOut)).toHaveLength(
      attempts - units,
    );
    await expect(remaining()).resolves.toBe(0);
  });

  it('grants one user a single live lease under concurrency', async () => {
    await gate.seed(saleId, PRODUCT, 100);

    const results = await Promise.all(
      Array.from({ length: 100 }, () => admit('same', 3)),
    );

    expect(results.filter((r) => r === ResultStatus.Success)).toHaveLength(1);
    await expect(remaining()).resolves.toBe(99);
  });
});
