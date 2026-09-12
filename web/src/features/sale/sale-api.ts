export type SaleStatus = 'upcoming' | 'active' | 'sold_out' | 'ended';

export type RejectionReason =
  'limit_reached' | 'sold_out' | 'upcoming' | 'ended';

export interface SaleItem {
  productId: string;
  name: string;
  priceCents: number;
  salePriceCents: number;
  maxPerUser: number;
  remainingStock: number;
}

export interface Sale {
  id: string;
  name: string;
  status: SaleStatus;
  startsAt: string;
  endsAt: string;
  serverTime: string;
  item: SaleItem;
}

export type PurchaseOutcome =
  | { result: 'success'; orderId: number }
  | { result: 'rejected'; reason: RejectionReason };

export interface UserPurchases {
  purchased: boolean;
  maxPerUser: number;
  orders: Array<{ orderId: number; priceCents: number; purchasedAt: string }>;
}

const BASE = '/api/v1/sale';

export async function fetchSale(): Promise<Sale> {
  const response = await fetch(BASE);
  if (!response.ok) {
    throw new Error(`sale request failed with ${response.status}`);
  }
  return response.json();
}

export async function purchase(userId: string): Promise<PurchaseOutcome> {
  const response = await fetch(`${BASE}/purchase`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const body = await response.json().catch(() => null);
  if (response.ok || body?.result === 'rejected') {
    return body as PurchaseOutcome;
  }
  throw new Error(`purchase request failed with ${response.status}`);
}

export async function fetchUserPurchases(
  userId: string,
): Promise<UserPurchases> {
  const response = await fetch(
    `${BASE}/purchase/${encodeURIComponent(userId)}`,
  );
  if (!response.ok) {
    throw new Error(`purchase lookup failed with ${response.status}`);
  }
  return response.json();
}
