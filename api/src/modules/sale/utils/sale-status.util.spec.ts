import { SaleConfig } from '../../../core/config/interfaces/app-config.interface';
import { computeStatus } from './sale-status.util';

const sale: SaleConfig = {
  id: 'test',
  startsAt: new Date('2026-01-01T10:00:00Z'),
  endsAt: new Date('2026-01-01T11:00:00Z'),
  stock: 10,
};

describe('computeStatus', () => {
  it('is upcoming before the window opens', () => {
    expect(computeStatus(sale, new Date('2026-01-01T09:59:59Z'), 10)).toBe(
      'upcoming',
    );
  });

  it('is active from the exact start time', () => {
    expect(computeStatus(sale, sale.startsAt, 10)).toBe('active');
  });

  it('is active inside the window with stock left', () => {
    expect(computeStatus(sale, new Date('2026-01-01T10:30:00Z'), 1)).toBe(
      'active',
    );
  });

  it('is sold_out inside the window with no stock', () => {
    expect(computeStatus(sale, new Date('2026-01-01T10:30:00Z'), 0)).toBe(
      'sold_out',
    );
  });

  it('is ended from the exact end time', () => {
    expect(computeStatus(sale, sale.endsAt, 10)).toBe('ended');
  });

  it('reports ended rather than sold_out after the window', () => {
    expect(computeStatus(sale, new Date('2026-01-01T12:00:00Z'), 0)).toBe(
      'ended',
    );
  });
});
