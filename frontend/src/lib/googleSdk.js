/**
 * Google Identity Services (GIS) central SDK loader.
 *
 * Implements:
 * - Global single script injection guard
 * - 15-second timeout to prevent indefinite hangs
 * - User-retryable reset on failure
 * - Status state tracking ('idle' | 'loading' | 'ready' | 'error')
 */

let sdkPromise = null;
let sdkState = 'idle';

export function getGoogleSdkState() {
  if (typeof window !== 'undefined' && window.google?.accounts?.id) {
    return 'ready';
  }
  return sdkState;
}

export function resetGoogleSdk() {
  sdkPromise = null;
  sdkState = 'idle';
  if (typeof document !== 'undefined') {
    const existing = document.getElementById('genie-google-identity-sdk');
    if (existing) {
      existing.remove();
    }
  }
}

export function loadGoogleSdk(timeoutMs = 15000) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google SDK can only be loaded in a browser environment'));
  }

  if (window.google?.accounts?.id) {
    sdkState = 'ready';
    return Promise.resolve(window.google);
  }

  if (sdkPromise) {
    return sdkPromise;
  }

  sdkState = 'loading';

  sdkPromise = new Promise((resolve, reject) => {
    let timer = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    timer = setTimeout(() => {
      cleanup();
      sdkState = 'error';
      sdkPromise = null;
      const script = document.getElementById('genie-google-identity-sdk');
      if (script) {
        script.remove();
      }
      reject(new Error('GOOGLE_SDK_TIMEOUT'));
    }, timeoutMs);

    let script = document.getElementById('genie-google-identity-sdk');
    if (!script) {
      script = document.createElement('script');
      script.id = 'genie-google-identity-sdk';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const onLoad = () => {
      cleanup();
      if (window.google?.accounts?.id) {
        sdkState = 'ready';
        resolve(window.google);
      } else {
        sdkState = 'error';
        sdkPromise = null;
        reject(new Error('GOOGLE_SDK_INVALID_OBJECT'));
      }
    };

    const onError = () => {
      cleanup();
      sdkState = 'error';
      sdkPromise = null;
      script.remove();
      reject(new Error('GOOGLE_SDK_LOAD_ERROR'));
    };

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
  });

  return sdkPromise;
}
