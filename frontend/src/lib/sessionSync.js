/**
 * Multi-tab session synchronization and tenant context guard.
 *
 * Provides:
 * - BroadcastChannel / storage fallback cross-tab communication
 * - Global fetch interception for X-Tenant-Context header
 * - Automatic 409 SESSION_CONTEXT_CHANGED detection and notification
 * - Safe credential-free event bus
 */

const CHANNEL_NAME = 'genie_session_sync';
const STORAGE_KEY = 'genie_session_event';

let broadcastChannel = null;
if (typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function') {
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  } catch (e) {
    console.warn('BroadcastChannel initialization failed, falling back to storage events:', e);
  }
}

const listeners = new Set();

function notifyListeners(event) {
  listeners.forEach((callback) => {
    try {
      callback(event);
    } catch (err) {
      console.error('Session sync listener error:', err);
    }
  });
}

// Attach BroadcastChannel listener
if (broadcastChannel) {
  broadcastChannel.onmessage = (msg) => {
    if (msg?.data?.type) {
      notifyListeners(msg.data);
    }
  };
}

// Attach storage fallback listener
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        if (data?.type) {
          notifyListeners(data);
        }
      } catch {
        // ignore malformed storage data
      }
    }
  });
}

/**
 * Broadcast an authentication or tenant state change event across tabs.
 * Never pass tokens, passwords, or credentials here.
 */
export function broadcastSessionEvent(type, payload = {}) {
  const event = {
    type, // 'LOGIN', 'LOGOUT', 'TENANT_CHANGED'
    tenant_id: payload.tenant_id || '',
    timestamp: Date.now(),
  };

  notifyListeners(event);

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(event);
    } catch {
      // Fall through to storage
    }
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
    } catch {
      // ignore storage quota errors
    }
  }
}

/**
 * Subscribe to session synchronization events from other tabs.
 */
export function subscribeToSessionEvents(callback) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

let tabTenantContext = '';

/**
 * Set tab-local in-memory tenant context bound to the currently rendered UI.
 */
export function setTenantContext(tenantId) {
  tabTenantContext = tenantId || '';
}

export function getTenantContext() {
  return tabTenantContext;
}

export function clearTenantContext() {
  tabTenantContext = '';
}

/**
 * Clear client-side tenant memory and cache.
 */
export function clearTenantMemory() {
  clearTenantContext();
  if (typeof window === 'undefined') return;
  ['genie_ai_user', 'genie_ai_token'].forEach((key) => {
    window.localStorage?.removeItem(key);
    window.sessionStorage?.removeItem(key);
  });
}

/**
 * Reads the currently active tenant ID, prioritizing the tab-local in-memory
 * context over shared storage to prevent stale tab cross-tenant writes.
 */
export function getActiveTenantId() {
  if (tabTenantContext) return tabTenantContext;
  if (typeof window === 'undefined') return '';
  const raw = window.localStorage?.getItem('genie_ai_user') || window.sessionStorage?.getItem('genie_ai_user');
  if (!raw) return '';
  try {
    const user = JSON.parse(raw);
    return user?.tenant_id || '';
  } catch {
    return '';
  }
}

let interceptorInstalled = false;

/**
 * Installs a window.fetch wrapper that:
 * 1. Automatically attaches X-Tenant-Context header on /api requests when active.
 * 2. Catches 409 SESSION_CONTEXT_CHANGED and alerts the session bus.
 */
export function installTenantContextInterceptor(onTenantConflict) {
  if (interceptorInstalled || typeof window === 'undefined') return;
  interceptorInstalled = true;

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    let [input, init] = args;
    init = init || {};

    const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
    const isApiRequest = url.includes('/api/') && !url.includes('/api/auth/login') && !url.includes('/api/auth/signup') && !url.includes('/api/auth/providers');

    if (isApiRequest) {
      const activeTenant = getActiveTenantId();
      if (activeTenant) {
        const headers = new Headers(init.headers || (input instanceof Request ? input.headers : {}));
        if (!headers.has('X-Tenant-Context')) {
          headers.set('X-Tenant-Context', activeTenant);
        }
        init = { ...init, headers };
      }
    }

    const response = await originalFetch.apply(this, [input, init]);

    if (response.status === 409) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        if (data?.detail === 'SESSION_CONTEXT_CHANGED' || data?.code === 'SESSION_CONTEXT_CHANGED') {
          console.warn('Detected active tenant context conflict across tabs.');
          broadcastSessionEvent('TENANT_CHANGED');
          if (typeof onTenantConflict === 'function') {
            onTenantConflict();
          }
        }
      } catch {
        // Not JSON or body already read
      }
    }

    return response;
  };
}
