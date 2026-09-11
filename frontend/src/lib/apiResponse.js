export class ApiResponseError extends Error {
  constructor(message, { status = 0, code = 'API_RESPONSE_INVALID' } = {}) {
    super(message);
    this.name = 'ApiResponseError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Read an API response without ever exposing an HTML proxy/provider error to
 * the UI. Vercel rewrites can return a Render error page when the backend is
 * unavailable; calling response.json() directly turns that outage into the
 * misleading "Unexpected token '<'" message.
 */
export async function parseApiJson(response, fallbackMessage) {
  const body = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const trimmedBody = body.trimStart();
  const looksLikeJson = trimmedBody.startsWith('{') || trimmedBody.startsWith('[');

  if (body && (contentType.includes('application/json') || looksLikeJson)) {
    try {
      return JSON.parse(body);
    } catch {
      // Fall through to one stable, user-safe error below.
    }
  }

  throw new ApiResponseError(fallbackMessage, {
    status: response.status,
    code: response.status === 503 ? 'API_UNAVAILABLE' : 'API_RESPONSE_INVALID',
  });
}
