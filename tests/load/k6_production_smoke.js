/* Production-safe, authenticated read-only smoke. No AI, webhook, write, or
 * account deletion calls. Run only with an explicitly authorized token. */
import http from 'k6/http';
import { check, sleep } from 'k6';

const base = __ENV.BASE_URL;
const token = __ENV.K6_TOKEN;

export const options = {
  vus: 1,
  duration: '5m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<750', 'p(99)<2000'],
  },
};

export default function () {
  const headers = { Authorization: `Bearer ${token}` };
  for (const path of ['/health/live', '/health/ready', '/api/auth/session', '/api/documents', '/api/bookings']) {
    const response = http.get(`${base}${path}`, { headers });
    check(response, { [`${path} healthy`]: (r) => r.status >= 200 && r.status < 300 });
  }
  sleep(1);
}
