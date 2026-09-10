import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { RedisAdmissionGate } from '../../src/modules/sale/gates/redis-admission.gate';

describe('RedisAdmissionGate (integration)', () => {
  const client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  const gate = new RedisAdmissionGate(client);
  const now = new Date('2026-01-01T10:00:00Z');
  let saleId: string;

  beforeEach(() => {
    saleId = `it-${randomUUID()}`;
  });

  afterEach(() => gate.reset(saleId));

  afterAll(() => client.quit());

  it('reports null before seeding and the stock after', async () => {
    await expect(gate.remaining(saleId)).resolves.toBeNull();
    await gate.seed(saleId, 3);
    await expect(gate.remaining(saleId)).resolves.toBe(3);
  });

  it('does not overwrite an existing ticket count on re-seed', async () => {
    await gate.seed(saleId, 3);
    await gate.admit(saleId, 'a', now);
    await gate.seed(saleId, 3);
    await expect(gate.remaining(saleId)).resolves.toBe(2);
  });

  it('admits distinct users until tickets run out', async () => {
    await gate.seed(saleId, 2);

    await expect(gate.admit(saleId, 'a', now)).resolves.toBe('admitted');
    await expect(gate.admit(saleId, 'b', now)).resolves.toBe('admitted');
    await expect(gate.admit(saleId, 'c', now)).resolves.toBe('sold_out');
    await expect(gate.remaining(saleId)).resolves.toBe(0);
  });

  it('rejects a repeat user without consuming a ticket', async () => {
    await gate.seed(saleId, 2);

    await gate.admit(saleId, 'a', now);
    await expect(gate.admit(saleId, 'a', now)).resolves.toBe(
      'already_admitted',
    );
    await expect(gate.remaining(saleId)).resolves.toBe(1);
  });

  it('reports already_admitted rather than sold_out for a holder', async () => {
    await gate.seed(saleId, 1);

    await gate.admit(saleId, 'a', now);
    await expect(gate.admit(saleId, 'a', now)).resolves.toBe(
      'already_admitted',
    );
  });

  it('releases a ticket back and ignores non-holders', async () => {
    await gate.seed(saleId, 1);
    await gate.admit(saleId, 'a', now);

    await expect(gate.release(saleId, 'nobody')).resolves.toBe(false);
    await expect(gate.release(saleId, 'a')).resolves.toBe(true);
    await expect(gate.remaining(saleId)).resolves.toBe(1);
    await expect(gate.admit(saleId, 'b', now)).resolves.toBe('admitted');
  });

  it('never admits more users than tickets under concurrency', async () => {
    const tickets = 20;
    const attempts = 500;
    await gate.seed(saleId, tickets);

    const results = await Promise.all(
      Array.from({ length: attempts }, (_, i) =>
        gate.admit(saleId, `user-${i}`, now),
      ),
    );

    const admitted = results.filter((r) => r === 'admitted').length;
    const soldOut = results.filter((r) => r === 'sold_out').length;
    expect(admitted).toBe(tickets);
    expect(soldOut).toBe(attempts - tickets);
    await expect(gate.remaining(saleId)).resolves.toBe(0);
  });
});
