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
  const now = new Date('2026-01-01T10:00:00Z');
  const PRODUCT = 'sneaker';
  let saleId: string;

  const admit = (userId: string, maxPerUser = 1) =>
    gate.admit({ saleId, productId: PRODUCT, userId, maxPerUser, now });

  beforeEach(() => {
    saleId = `it-${randomUUID()}`;
  });

  afterEach(() => gate.reset(saleId, PRODUCT));

  afterAll(() => redisClient.quit());

  it('reports null before seeding and the stock after', async () => {
    await expect(gate.remainingTickets(saleId, PRODUCT)).resolves.toBeNull();
    await gate.seed(saleId, PRODUCT, 3);
    await expect(gate.remainingTickets(saleId, PRODUCT)).resolves.toBe(3);
  });

  it('does not overwrite an existing ticket count on re-seed', async () => {
    await gate.seed(saleId, PRODUCT, 3);
    await admit('a');
    await gate.seed(saleId, PRODUCT, 3);
    await expect(gate.remainingTickets(saleId, PRODUCT)).resolves.toBe(2);
  });

  it('admits distinct users until tickets run out', async () => {
    await gate.seed(saleId, PRODUCT, 2);

    await expect(admit('a')).resolves.toBe(ResultStatus.Success);
    await expect(admit('b')).resolves.toBe(ResultStatus.Success);
    await expect(admit('c')).resolves.toBe(RejectionReason.SoldOut);
    await expect(gate.remainingTickets(saleId, PRODUCT)).resolves.toBe(0);
  });

  it('rejects a repeat user without consuming a ticket', async () => {
    await gate.seed(saleId, PRODUCT, 2);

    await admit('a');
    await expect(admit('a')).resolves.toBe(RejectionReason.LimitReached);
    await expect(gate.remainingTickets(saleId, PRODUCT)).resolves.toBe(1);
  });

  it('allows up to maxPerUser units for one user', async () => {
    await gate.seed(saleId, PRODUCT, 5);

    await expect(admit('a', 2)).resolves.toBe(ResultStatus.Success);
    await expect(admit('a', 2)).resolves.toBe(ResultStatus.Success);
    await expect(admit('a', 2)).resolves.toBe(RejectionReason.LimitReached);
    await expect(gate.remainingTickets(saleId, PRODUCT)).resolves.toBe(3);
  });

  it('releases one unit at a time and ignores non-holders', async () => {
    await gate.seed(saleId, PRODUCT, 2);
    await admit('a', 2);
    await admit('a', 2);

    await expect(gate.release(saleId, PRODUCT, 'nobody')).resolves.toBe(false);
    await expect(gate.release(saleId, PRODUCT, 'a')).resolves.toBe(true);
    await expect(gate.remainingTickets(saleId, PRODUCT)).resolves.toBe(1);
    await expect(gate.release(saleId, PRODUCT, 'a')).resolves.toBe(true);
    await expect(gate.release(saleId, PRODUCT, 'a')).resolves.toBe(false);
    await expect(gate.remainingTickets(saleId, PRODUCT)).resolves.toBe(2);
  });

  it('never admits more users than tickets under concurrency', async () => {
    const tickets = 20;
    const attempts = 500;
    await gate.seed(saleId, PRODUCT, tickets);

    const results = await Promise.all(
      Array.from({ length: attempts }, (_, i) => admit(`user-${i}`)),
    );

    expect(results.filter((r) => r === ResultStatus.Success)).toHaveLength(
      tickets,
    );
    expect(results.filter((r) => r === RejectionReason.SoldOut)).toHaveLength(
      attempts - tickets,
    );
    await expect(gate.remainingTickets(saleId, PRODUCT)).resolves.toBe(0);
  });

  it('never admits one user past the limit under concurrency', async () => {
    await gate.seed(saleId, PRODUCT, 100);

    const results = await Promise.all(
      Array.from({ length: 100 }, () => admit('same', 3)),
    );

    expect(results.filter((r) => r === ResultStatus.Success)).toHaveLength(3);
    await expect(gate.remainingTickets(saleId, PRODUCT)).resolves.toBe(97);
  });
});
