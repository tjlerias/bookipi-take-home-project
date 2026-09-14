import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

export const API_URL = __ENV.API_URL ?? 'http://localhost:3000';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const attempts = new Counter('purchase_attempts');
const success = new Counter('purchase_success');
const soldOut = new Counter('purchase_sold_out');
const limitReached = new Counter('purchase_limit_reached');
const unavailable = new Counter('purchase_unavailable');
const unexpected = new Counter('purchase_unexpected');
const duration = new Trend('purchase_duration', true);
const assertion = new Rate('assertion');

function parseJson(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

export function fetchSale() {
  const response = http.get(`${API_URL}/api/v1/sale`, {
    tags: { name: 'sale' },
  });

  if (response.status !== 200) {
    throw new Error(`GET /sale failed with status ${response.status}`);
  }

  return response.json();
}

export function fetchPurchases(userId) {
  return http
    .get(`${API_URL}/api/v1/sale/purchase/${encodeURIComponent(userId)}`, {
      tags: { name: 'purchases' },
    })
    .json();
}

export function purchase(userId) {
  const response = http.post(
    `${API_URL}/api/v1/sale/purchase`,
    JSON.stringify({ userId }),
    {
      headers: JSON_HEADERS,
      tags: { name: 'purchase' },
    },
  );

  attempts.add(1);
  duration.add(response.timings.duration);

  const body = parseJson(response);
  const reason = body?.reason;

  if (response.status === 200 && body?.result === 'success') {
    success.add(1);
  } else if (response.status === 409 && reason === 'sold_out') {
    soldOut.add(1);
  } else if (response.status === 409 && reason === 'limit_reached') {
    limitReached.add(1);
  } else if (response.status === 503) {
    unavailable.add(1);
  } else {
    unexpected.add(1);
  }

  return response;
}

export function requireSale({ stock, maxPerUser = 1 }) {
  const sale = fetchSale();

  if (sale.status !== 'active') {
    throw new Error(
      `sale is ${sale.status}: run sale:reset, then restart the API if the window changed`,
    );
  }

  if (sale.item.remainingStock !== stock) {
    throw new Error(
      `expected ${stock} items, the sale has ${sale.item.remainingStock}: run STOCK=${stock} npm run sale:reset`,
    );
  }

  if (sale.item.maxPerUser !== maxPerUser) {
    throw new Error(
      `expected maxPerUser ${maxPerUser}, the sale has ${sale.item.maxPerUser}`,
    );
  }

  return sale;
}

export function baseThresholds(assertions = []) {
  const result = {
    purchase_unexpected: ['count==0'],
    'http_req_failed{name:purchase}': ['rate==0'],
  };

  for (const name of assertions) {
    result[`assertion{name:${name}}`] = ['rate==1'];
  }

  return result;
}

export function assert(name, ok) {
  assertion.add(ok, { name });

  if (!ok) {
    console.error(`assertion failed: ${name}`);
  }
}

const number = (n) =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const ms = (n) => `${(n ?? 0).toFixed(1)} ms`;
const rate = (n) => `${number(n ?? 0)}/s`;
const row = (label, value) =>
  `${label.padEnd(24)}${String(value).padStart(12)}`;

export function summarize(name, data, { traffic = false } = {}) {
  const m = data.metrics;
  const count = (key) => m[key]?.values.count ?? 0;
  const perSecond = (key) => m[key]?.values.rate ?? 0;

  const correctness = [];
  for (const [metric, { thresholds }] of Object.entries(m)) {
    for (const [expression, { ok }] of Object.entries(thresholds ?? {})) {
      const label = metric.startsWith('assertion{')
        ? metric.slice('assertion{name:'.length, -1).replace(/_/g, ' ')
        : `${metric} ${expression}`;
      correctness.push(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
    }
  }
  correctness.sort();
  const passed = correctness.every((line) => line.startsWith('PASS'));

  const latency = m.purchase_duration?.values ?? {};
  const lines = [
    '',
    `=== ${name}: ${passed ? 'PASS' : 'FAIL'} ===`,
    '',
    'Correctness',
    ...correctness,
    '',
    ...(traffic
      ? [
          'Traffic',
          row('HTTP requests', number(count('http_reqs'))),
          row('HTTP throughput', rate(perSecond('http_reqs'))),
          row('purchase attempts', number(count('purchase_attempts'))),
          row('purchase throughput', rate(perSecond('purchase_attempts'))),
          row('successful purchases', rate(perSecond('purchase_success'))),
          row('dropped iterations', number(count('dropped_iterations'))),
          '',
        ]
      : []),
    'Outcomes',
    row('success', number(count('purchase_success'))),
    row('sold_out', number(count('purchase_sold_out'))),
    row('limit_reached', number(count('purchase_limit_reached'))),
    row('unavailable (503)', number(count('purchase_unavailable'))),
    row('unexpected', number(count('purchase_unexpected'))),
    '',
    'Performance (informational, this machine only)',
    row('purchase p50', ms(latency.med)),
    row('purchase p95', ms(latency['p(95)'])),
    row('purchase max', ms(latency.max)),
    '',
  ];

  return lines.join('\n');
}
