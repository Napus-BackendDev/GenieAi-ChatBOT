import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiResponseError, parseApiJson } from './apiResponse.js';

test('parses a JSON API response', async () => {
  const response = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

  assert.deepEqual(await parseApiJson(response, 'unavailable'), { ok: true });
});

test('maps an HTML 503 response to a stable API outage error', async () => {
  const response = new Response('<!DOCTYPE html><title>Service Suspended</title>', {
    status: 503,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });

  await assert.rejects(
    () => parseApiJson(response, 'ระบบเข้าสู่ระบบไม่พร้อมใช้งาน'),
    (error) => {
      assert.ok(error instanceof ApiResponseError);
      assert.equal(error.code, 'API_UNAVAILABLE');
      assert.equal(error.status, 503);
      assert.equal(error.message, 'ระบบเข้าสู่ระบบไม่พร้อมใช้งาน');
      return true;
    },
  );
});

test('does not expose malformed proxy response content', async () => {
  const response = new Response('<html>provider details</html>', {
    status: 502,
    headers: { 'content-type': 'text/html' },
  });

  await assert.rejects(
    () => parseApiJson(response, 'safe fallback'),
    (error) => error.message === 'safe fallback' && !error.message.includes('provider details'),
  );
});
