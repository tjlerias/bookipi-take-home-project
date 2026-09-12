import { useEffect, useState } from 'react';

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
const TICK_MS = MS_PER_SECOND;

export function useCountdown(
  target: string | null,
  clockOffsetMs: number,
): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!target) {
      return;
    }
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [target]);

  if (!target) {
    return 0;
  }
  return Math.max(new Date(target).getTime() - (nowMs + clockOffsetMs), 0);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / MS_PER_SECOND);
  const days = Math.floor(totalSeconds / SECONDS_PER_DAY);
  const hours = Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor(
    (totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE,
  );
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}
