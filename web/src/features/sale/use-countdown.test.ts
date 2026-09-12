import { describe, expect, it } from 'vitest';
import { formatDuration } from './use-countdown';

describe('formatDuration', () => {
  it('formats zero', () => {
    expect(formatDuration(0)).toBe('00:00:00');
  });

  it('pads hours, minutes, and seconds', () => {
    expect(formatDuration(5_000)).toBe('00:00:05');
    expect(formatDuration(65_000)).toBe('00:01:05');
    expect(formatDuration(3_725_000)).toBe('01:02:05');
  });

  it('drops fractional seconds', () => {
    expect(formatDuration(1_999)).toBe('00:00:01');
  });

  it('shows days only when there are any', () => {
    expect(formatDuration(86_400_000)).toBe('1d 00:00:00');
    expect(formatDuration(93_784_000)).toBe('1d 02:03:04');
  });
});
