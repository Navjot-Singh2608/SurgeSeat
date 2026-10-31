import { request, setAccessToken, refreshAccessToken } from './client';

// Every endpoint the UI uses. The backend must match docs/api-contract.md.
export const realApi = {
  // ---- auth ----
  async register({ email, password }) {
    return request('/auth/register', { method: 'POST', body: { email, password }, auth: false });
  },
  async login({ email, password }) {
    const data = await request('/auth/login', { method: 'POST', body: { email, password }, auth: false });
    setAccessToken(data.access_token);
    return data;
  },
  async restoreSession() {
    // Uses the httpOnly refresh cookie, if any, to get a fresh access token after a page reload.
    await refreshAccessToken();
    return request('/auth/me');
  },
  async logout() {
    try {
      await request('/auth/logout', { method: 'POST', auth: false });
    } finally {
      setAccessToken(null);
    }
  },
  me() {
    return request('/auth/me');
  },

  // ---- events ----
  listEvents({ page = 1, pageSize = 12 } = {}) {
    return request(`/events?page=${page}&page_size=${pageSize}`);
  },
  getEvent(id) {
    return request(`/events/${encodeURIComponent(id)}`);
  },

  // ---- reservations ----
  createReservation({ tierId, qty, idempotencyKey }) {
    return request('/reservations', {
      method: 'POST',
      body: { tier_id: tierId, qty },
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  },
  getReservation(id) {
    return request(`/reservations/${encodeURIComponent(id)}`);
  },
  listMyReservations() {
    return request('/me/reservations');
  },

  // ---- admin ----
  createEvent(payload) {
    return request('/admin/events', { method: 'POST', body: payload });
  },
};
