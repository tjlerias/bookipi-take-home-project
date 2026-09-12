import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sale } from './sale-api';
import { nextRefreshDelay } from './use-sale';

const now = new Date('2026-01-01T10:00:00Z');

function makeSale(overrides: Partial<Sale>): Sale {
  return {
    id: 'flash-sale-1',
    name: 'Flash Sale',
    status: 'active',
    startsAt: '2026-01-01T09:00:00.000Z',
    endsAt: '2026-01-01T11:00:00.000Z',
    serverTime: now.toISOString(),
    item: {
      productId: 'p',
      name: 'P',
      priceCents: 100,
      salePriceCents: 50,
      maxPerUser: 1,
      remainingStock: 1,
    },
    ...overrides,
  };
}

describe('nextRefreshDelay', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing before the sale has loaded', () => {
    expect(nextRefreshDelay(null, 0)).toBeNull();
  });

  it('waits until just after the start while upcoming', () => {
    const sale = makeSale({
      status: 'upcoming',
      startsAt: '2026-01-01T10:05:00.000Z',
    });
    expect(nextRefreshDelay(sale, 0)).toBe(5 * 60_000 + 250);
  });

  it('refetches right away when an upcoming sale should already have started', () => {
    const sale = makeSale({
      status: 'upcoming',
      startsAt: '2026-01-01T09:59:59.000Z',
    });
    expect(nextRefreshDelay(sale, 0)).toBe(250);
  });

  it('heartbeats every 10 seconds while live', () => {
    expect(nextRefreshDelay(makeSale({}), 0)).toBe(10_000);
  });

  it('shortens the last heartbeat to land just after the end', () => {
    const sale = makeSale({ endsAt: '2026-01-01T10:00:03.000Z' });
    expect(nextRefreshDelay(sale, 0)).toBe(3_000 + 250);
  });

  it('keeps polling a sold-out sale until it ends', () => {
    expect(nextRefreshDelay(makeSale({ status: 'sold_out' }), 0)).toBe(10_000);
  });

  it('stops once the sale has ended', () => {
    const sale = makeSale({
      status: 'ended',
      endsAt: '2026-01-01T09:30:00.000Z',
    });
    expect(nextRefreshDelay(sale, 0)).toBeNull();
  });

  it('uses the server clock offset, not the browser clock', () => {
    const sale = makeSale({ endsAt: '2026-01-01T10:00:03.000Z' });
    expect(nextRefreshDelay(sale, 2_000)).toBe(1_000 + 250);
  });
});
