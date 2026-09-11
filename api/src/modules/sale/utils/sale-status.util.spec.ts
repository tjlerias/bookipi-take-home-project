import { SaleStatus } from '../enums/sale-status.enum';
import { computeStatus, SalePeriod } from './sale-status.util';

const sale: SalePeriod = {
  startsAt: new Date('2026-01-01T10:00:00Z'),
  endsAt: new Date('2026-01-01T11:00:00Z'),
};

describe('computeStatus', () => {
  it('is upcoming before the window opens', () => {
    expect(computeStatus(sale, new Date('2026-01-01T09:59:59Z'), 10)).toBe(
      SaleStatus.Upcoming,
    );
  });

  it('is active from the exact start time', () => {
    expect(computeStatus(sale, sale.startsAt, 10)).toBe(SaleStatus.Active);
  });

  it('is active inside the window with stock left', () => {
    expect(computeStatus(sale, new Date('2026-01-01T10:30:00Z'), 1)).toBe(
      SaleStatus.Active,
    );
  });

  it('is sold_out inside the window with no stock', () => {
    expect(computeStatus(sale, new Date('2026-01-01T10:30:00Z'), 0)).toBe(
      SaleStatus.SoldOut,
    );
  });

  it('is ended from the exact end time', () => {
    expect(computeStatus(sale, sale.endsAt, 10)).toBe(SaleStatus.Ended);
  });

  it('reports ended rather than sold_out after the window', () => {
    expect(computeStatus(sale, new Date('2026-01-01T12:00:00Z'), 0)).toBe(
      SaleStatus.Ended,
    );
  });
});
