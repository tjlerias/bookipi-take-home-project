import http from 'k6/http';
import {
  assert,
  baseThresholds,
  fetchPurchases,
  purchase,
  requireSale,
  summarize,
} from './helpers.js';

// A small set of customers each fire CONCURRENCY purchase requests at the same instant.
// Proves maxPerUser survives concurrency: every customer ends with exactly maxPerUser orders.
// Stock must cover every customer so the gate never rejects for sold_out here.

const USERS = Number(__ENV.USERS ?? 50);
const CONCURRENCY = Number(__ENV.CONCURRENCY ?? 20);
const STOCK = Number(__ENV.STOCK ?? 100);

const ASSERTIONS = ['every_customer_has_exactly_max_per_user_orders'];

http.setResponseCallback(http.expectedStatuses(200, 409));

export const options = {
  scenarios: {
    hammer: {
      executor: 'per-vu-iterations',
      vus: USERS * CONCURRENCY,
      iterations: 1,
      maxDuration: '2m',
    },
  },
  thresholds: {
    ...baseThresholds(ASSERTIONS),
    purchase_success: [`count==${USERS}`],
    purchase_sold_out: ['count==0'],
  },
};

function userId(vu) {
  return `hammer-${(vu - 1) % USERS}@stress.test`;
}

export function setup() {
  if (STOCK < USERS) {
    throw new Error(`STOCK (${STOCK}) must cover every customer (${USERS})`);
  }

  requireSale({ stock: STOCK });
}

export default function () {
  purchase(userId(__VU));
}

// The purchase lookup reads orders from Postgres, so it is the source of truth for the check.
export function teardown() {
  let exact = 0;

  for (let i = 0; i < USERS; i += 1) {
    const { orders, maxPerUser } = fetchPurchases(`hammer-${i}@stress.test`);

    if (orders.length === maxPerUser) {
      exact += 1;
    } else {
      console.error(`hammer-${i} has ${orders.length} orders`);
    }
  }

  console.log(`customers with exactly maxPerUser orders: ${exact} of ${USERS}`);

  assert('every_customer_has_exactly_max_per_user_orders', exact === USERS);
}

export function handleSummary(data) {
  return { stdout: summarize('hammer', data) };
}
