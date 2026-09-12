import { useCallback, useEffect, useState } from 'react';
import { fetchSale, type Sale } from '@/features/sale/sale-api';

const LIVE_POLL_MS = 10_000;
const BOUNDARY_GRACE_MS = 250;

export interface SaleState {
  sale: Sale | null;
  error: string | null;
  // serverTime minus the browser clock, so countdowns follow the server.
  clockOffsetMs: number;
}

export function useSale(): SaleState {
  const [sale, setSale] = useState<Sale | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchSale();
      setSale(next);
      setClockOffsetMs(new Date(next.serverTime).getTime() - Date.now());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearTimeout(initial);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh]);

  useEffect(() => {
    const delay = nextRefreshDelay(sale, clockOffsetMs);
    if (delay === null) {
      return;
    }
    const timer = setTimeout(() => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [sale, clockOffsetMs, refresh]);

  return { sale, error, clockOffsetMs };
}

// Upcoming: one fetch when the sale opens. Live: a slow heartbeat until it ends. Ended: nothing.
export function nextRefreshDelay(
  sale: Sale | null,
  clockOffsetMs: number,
): number | null {
  if (!sale) {
    return null;
  }
  const now = Date.now() + clockOffsetMs;
  const startsIn = new Date(sale.startsAt).getTime() - now;
  const endsIn = new Date(sale.endsAt).getTime() - now;
  if (sale.status === 'upcoming') {
    return Math.max(startsIn, 0) + BOUNDARY_GRACE_MS;
  }
  if (endsIn > 0) {
    return Math.min(LIVE_POLL_MS, endsIn + BOUNDARY_GRACE_MS);
  }
  return null;
}
