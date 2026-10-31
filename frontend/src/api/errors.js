// One error shape for the whole UI, whatever the backend returns.
// Supports FastAPI's default {"detail": "..."} and the structured
// {"detail": {"code": "...", "message": "..."}} described in docs/api-contract.md.
export class ApiError extends Error {
  constructor({ status, code, message, retryAfter = null, fields = null }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;      // HTTP status, or 0 for network failures
    this.code = code;          // machine-readable, e.g. SOLD_OUT, RATE_LIMITED
    this.retryAfter = retryAfter; // seconds, from Retry-After on 429/503
    this.fields = fields;      // validation errors keyed by field name
  }

  get isNetwork() {
    return this.status === 0;
  }
}

const DEFAULT_CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
  503: 'UNAVAILABLE',
};

export async function toApiError(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    /* non-JSON error body (e.g. NGINX 502 page) */
  }

  const retryHeader = response.headers.get('Retry-After');
  const retryAfter = retryHeader ? Number(retryHeader) || null : null;
  const detail = body?.detail;

  let code = DEFAULT_CODES[response.status] || 'ERROR';
  let message = response.statusText || 'Request failed';
  let fields = null;

  if (typeof detail === 'string') {
    message = detail;
  } else if (Array.isArray(detail)) {
    // FastAPI/Pydantic validation errors
    fields = {};
    for (const err of detail) {
      const field = err.loc?.[err.loc.length - 1];
      if (field) fields[field] = err.msg;
    }
    message = 'Please check the highlighted fields.';
  } else if (detail && typeof detail === 'object') {
    code = detail.code || code;
    message = detail.message || message;
    fields = detail.fields || null;
  }

  if (response.status >= 500 && !body) {
    message = 'The server is unavailable. Please try again shortly.';
  }

  return new ApiError({ status: response.status, code, message, retryAfter, fields });
}

export function networkError() {
  return new ApiError({
    status: 0,
    code: 'NETWORK_ERROR',
    message: 'Could not reach the server. Check your connection and try again.',
  });
}
