import assert from 'node:assert/strict';
import test from 'node:test';
import {
  broadcastSessionEvent,
  subscribeToSessionEvents,
  getActiveTenantId,
  clearTenantMemory,
  setTenantContext,
  clearTenantContext,
} from './sessionSync.js';
import { getGoogleSdkState, resetGoogleSdk } from './googleSdk.js';

test('googleSdk initial state is idle and reset clears properly', () => {
  resetGoogleSdk();
  assert.equal(getGoogleSdkState(), 'idle');
});

test('sessionSync subscribes and receives broadcast events', async () => {
  let received = null;
  const unsubscribe = subscribeToSessionEvents((event) => {
    received = event;
  });

  broadcastSessionEvent('LOGIN', { tenant_id: 'test_tenant_123' });

  // Give microtask tick to process listener
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.ok(received);
  assert.equal(received.type, 'LOGIN');
  assert.equal(received.tenant_id, 'test_tenant_123');

  unsubscribe();
});

test('clearTenantMemory removes local auth items safely', () => {
  assert.doesNotThrow(() => {
    clearTenantMemory();
  });
  assert.equal(getActiveTenantId(), '');
});

test('tab-local tenant context prioritizes in-memory active tenant', () => {
  setTenantContext('tenant_tab_memory');
  assert.equal(getActiveTenantId(), 'tenant_tab_memory');
  clearTenantContext();
  assert.equal(getActiveTenantId(), '');
});
