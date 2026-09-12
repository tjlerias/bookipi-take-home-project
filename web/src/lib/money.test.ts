import { describe, expect, it } from 'vitest';
import { formatCents } from './money';

describe('formatCents', () => {
  it('formats whole and fractional dollars', () => {
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(5)).toBe('$0.05');
    expect(formatCents(9999)).toBe('$99.99');
    expect(formatCents(19900)).toBe('$199.00');
  });

  it('adds thousands separators', () => {
    expect(formatCents(123_456_789)).toBe('$1,234,567.89');
  });
});
