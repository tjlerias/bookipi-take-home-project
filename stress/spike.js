import http from 'k6/http';
import {
  assert,
  baseThresholds,
  fetchPurchases,
  fetchSale,
  purchase,
  requireSale,
  summarize,
} from './helpers.js';

// A burst of distinct customers competing for limited stock, all released together.
// Proves the sale cannot oversell: exactly STOCK orders, remaining stock 0, no customer above the limit.

const USERS = Number(__ENV.USERS ?? 2000);
const STOCK = Number(__ENV.STOCK ?? 100);

const ASSERTIONS = [
  'remaining_stock_is_zero',
  'no_customer_above_max_per_user',
];

http.setResponseCallback(http.expectedStatuses(200, 409));

export const options = {
  scenarios: {
    spike: {
      executor: 'per-vu-iterations',
      vus: USERS,
      iterations: 1,
      maxDuration: '2m',
    },
  },
  thresholds: {
    ...baseThresholds(ASSERTIONS),
    purchase_success: [`count==${STOCK}`],
  },
};

export function setup() {
  requireSale({ stock: STOCK });
}

export default function () {
  purchase(`spike-${__VU}@stress.test`);
}

export function teardown() {
  const sale = fetchSale();

  assert('remaining_stock_is_zero', sale.item.remainingStock === 0);

  let overLimit = 0;
  for (let vu = 1; vu <= USERS; vu += 1) {
    if (
      fetchPurchases(`spike-${vu}@stress.test`).orders.length >
      sale.item.maxPerUser
    ) {
      overLimit += 1;
    }
  }

  assert('no_customer_above_max_per_user', overLimit === 0);
}

export function handleSummary(data) {
  return { stdout: summarize('spike', data) };
}
