/*
 * Free local capacity/soak profile. Requires only k6 and a local token:
 *   k6 run -e BASE_URL=http://127.0.0.1:8080 -e K6_TOKEN=... tests/load/k6_local.js
 *
 * The default profile is read-only. Booking writes are deliberately opt-in via
 * K6_ENABLE_WRITES=true and must point at a disposable QA tenant.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const base = __ENV.BASE_URL || 'http://127.0.0.1:8080';
const token = __ENV.K6_TOKEN || '';
const profile = __ENV.K6_PROFILE || 'load';
const headers = token ? { Authorization: `Bearer ${token}` } : {};

const profiles = {
  smoke: { vus: 1, duration: '5m' },
  load: { vus: 10, duration: '10m' },
  soak: { vus: 5, duration: '2h' },
};

const matrix = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: [
    { target: 1, duration: '10s' },
    { target: 1, duration: '5m' },
    { target: 5, duration: '10s' },
    { target: 5, duration: '10m' },
    { target: 10, duration: '10s' },
    { target: 10, duration: '10m' },
    { target: 20, duration: '10s' },
    { target: 20, duration: '10m' },
    { target: 5, duration: '10s' },
    { target: 5, duration: '5m' },
    { target: 0, duration: '10s' },
  ],
  gracefulRampDown: '30s',
};

export const options = {
  scenarios: {
    api: profile === 'matrix' ? matrix : {
        executor: 'constant-vus',
        vus: (profiles[profile] || profiles.load).vus,
        duration: (profiles[profile] || profiles.load).duration,
      },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{non_ai:true}': ['p(95)<750', 'p(99)<2000'],
  },
};

function get(path) {
  const response = http.get(`${base}${path}`, { headers, tags: { non_ai: 'true' } });
  check(response, { [`${path} is not 5xx`]: (r) => r.status < 500 });
  return response;
}

export default function () {
  get('/health/live');
  get('/health/ready');
  if (token) {
    get('/api/auth/session');
    get('/api/documents');
    get('/api/bookings');
  }
  sleep(1);
}
