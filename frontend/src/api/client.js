import { ApiError, toApiError, networkError } from './errors';

const BASE = import.meta.env.VITE_API_BASE || '/api/v1';

// The access token lives only in memory (not localStorage) so injected scripts
// cannot read it from storage. The refresh token is an httpOnly cookie set by
// the backend; the browser sends it automatically and JS never sees it.
let accessToken = null;
let onSessionExpired = () => {};
let refreshInFlight = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
}

async function rawFetch(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  const finalHeaders = { Accept: 'application/json', ...headers };
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';
  if (auth && accessToken) finalHeaders.Authorization = `Bearer ${accessToken}`;

  try {
    return await fetch(`${BASE}${path}`, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
  } catch {
    throw networkError();
  }
}

// Many requests can hit 401 at once when the token expires.
// They all share one refresh call instead of stampeding /auth/refresh.
export function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const res = await rawFetch('/auth/refresh', { method: 'POST', auth: false });
      if (!res.ok) throw await toApiError(res);
      const data = await res.json();
      setAccessToken(data.access_token);
      return data;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function request(path, options = {}) {
  let res = await rawFetch(path, options);

  if (res.status === 401 && options.auth !== false) {
    try {
      await refreshAccessToken();
    } catch {
      setAccessToken(null);
      onSessionExpired();
      throw new ApiError({ status: 401, code: 'SESSION_EXPIRED', message: 'Your session has expired. Please log in again.' });
    }
    res = await rawFetch(path, options);
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return null;
  return res.json();
}
