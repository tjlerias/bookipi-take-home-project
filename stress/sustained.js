import http from 'k6/http';
import {
  assert,
  baseThresholds,
  fetchSale,
  purchase,
  requireSale,
  summarize,
} from './helpers.js';

// Constant request rate for a fixed duration with enough stock that purchases keep succeeding.
// Measures how much real purchase traffic the API sustains before dropping requests or failing.

const RATE = Number(__ENV.RATE ?? 1000);
const DURATION = __ENV.DURATION ?? '10s';
const STOCK = Number(__ENV.STOCK ?? 100000);

const ASSERTIONS = ['remaining_stock_not_negative', 'stock_never_ran_out'];

http.setResponseCallback(http.expectedStatuses(200, 409));

export const options = {
  scenarios: {
    sustained: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: Math.ceil(RATE / 4),
      maxVUs: RATE * 2,
    },
  },
  thresholds: {
    ...baseThresholds(ASSERTIONS),
    dropped_iterations: ['count==0'],
  },
};

export function setup() {
  requireSale({ stock: STOCK });
}

export default function () {
  purchase(`sustained-${__VU}-${__ITER}@stress.test`);
}

export function teardown() {
  const sale = fetchSale();
  const sold = STOCK - sale.item.remainingStock;

  console.log(`sustained: ${sold} sold of ${STOCK}`);

  assert('remaining_stock_not_negative', sale.item.remainingStock >= 0);
  assert('stock_never_ran_out', sale.item.remainingStock > 0);
}

export function handleSummary(data) {
  return { stdout: summarize('sustained', data, { traffic: true }) };
}
