import { ApiError } from './errors';

// In-browser fake backend so the UI can be developed and demoed with no services running.
// It imitates the real contract, including the behaviour the backend must get right:
// sold-out (409), rate limiting (429 + Retry-After), idempotency keys, and the
// asynchronous PENDING -> CONFIRMED transition done by the Kafka worker.
//
// Demo accounts:  admin@surgeseat.dev / admin1234   (ADMIN)
//                 user@surgeseat.dev  / user12345   (USER)

const SESSION_KEY = 'surgeseat.mock.session';
const DB_KEY = 'surgeseat.mock.db';
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const latency = () => delay(150 + Math.random() * 250);
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const now = () => new Date().toISOString();
const inDays = (d, h = 19) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  t.setHours(h, 0, 0, 0);
  return t.toISOString();
};

const seed = () => ({
  users: [
    { id: 'usr_admin', email: 'admin@surgeseat.dev', password: 'admin1234', role: 'ADMIN' },
    { id: 'usr_demo', email: 'user@surgeseat.dev', password: 'user12345', role: 'USER' },
  ],
  events: [
    {
      id: 'evt_1', name: 'Northern Lights Live', venue: 'Scotiabank Arena, Toronto', starts_at: inDays(12),
      status: 'ON_SALE', description: 'An evening concert with a full light show.',
      tiers: [
        { id: 'tier_1a', name: 'Floor', price_cents: 18900, capacity: 500, available: 3 },
        { id: 'tier_1b', name: 'Lower Bowl', price_cents: 12900, capacity: 2000, available: 640 },
        { id: 'tier_1c', name: 'Upper Bowl', price_cents: 6900, capacity: 4000, available: 2210 },
      ],
    },
    {
      id: 'evt_2', name: 'Distributed Systems Summit', venue: 'Metro Toronto Convention Centre', starts_at: inDays(30, 9),
      status: 'ON_SALE', description: 'Talks on consensus, queues and scaling.',
      tiers: [
        { id: 'tier_2a', name: 'Conference Pass', price_cents: 49900, capacity: 800, available: 412 },
        { id: 'tier_2b', name: 'Workshop Add-on', price_cents: 19900, capacity: 60, available: 0 },
      ],
    },
    {
      id: 'evt_3', name: 'Raptors vs Celtics', venue: 'Scotiabank Arena, Toronto', starts_at: inDays(5, 20),
      status: 'ON_SALE', description: 'Regular season game.',
      tiers: [
        { id: 'tier_3a', name: 'Courtside', price_cents: 95000, capacity: 40, available: 0 },
        { id: 'tier_3b', name: 'Club', price_cents: 32000, capacity: 600, available: 0 },
      ],
    },
    {
      id: 'evt_4', name: 'Indie Film Night', venue: 'TIFF Lightbox', starts_at: inDays(8, 18),
      status: 'ON_SALE', description: 'Three short films and a Q&A.',
      tiers: [{ id: 'tier_4a', name: 'General Admission', price_cents: 2500, capacity: 300, available: 187 }],
    },
  ],
  reservations: [],
  idempotency: {}, // `${userId}:${key}` -> reservation id
});

// The mock "database" survives page reloads (sessionStorage) so the app behaves
// like a real backend while you click around. Close the tab to reset it.
function loadDb() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DB_KEY) || 'null');
    if (saved) return saved;
  } catch {
    /* ignore */
  }
  return seed();
}
const db = loadDb();
const attempts = new Map(); // userId -> timestamps of recent reservation attempts
function save() {
  try {
    sessionStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    /* ignore */
  }
}

function fail(status, code, message, extra = {}) {
  throw new ApiError({ status, code, message, ...extra });
}

function currentUser() {
  let session = null;
  try {
    session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    /* storage unavailable */
  }
  const user = session && db.users.find((u) => u.id === session.userId);
  if (!user) fail(401, 'UNAUTHORIZED', 'Please log in.');
  return user;
}

const publicUser = (u) => ({ id: u.id, email: u.email, role: u.role });

function summary(e) {
  return {
    id: e.id, name: e.name, venue: e.venue, starts_at: e.starts_at, status: e.status,
    min_price_cents: Math.min(...e.tiers.map((t) => t.price_cents)),
    available: e.tiers.reduce((n, t) => n + t.available, 0),
  };
}

function view(r) {
  const event = db.events.find((e) => e.id === r.event_id);
  const tier = event.tiers.find((t) => t.id === r.tier_id);
  const { _confirm_at, ...pub } = r;
  return {
    ...pub,
    event_name: event.name,
    tier_name: tier.name,
    total_price_cents: tier.price_cents * r.qty,
  };
}

// Stand-in for the outbox relay + Kafka + confirmation worker: each reservation gets
// a time at which the "worker" will have confirmed it, applied lazily on read.
function settle() {
  let changed = false;
  for (const r of db.reservations) {
    if (r.status === 'PENDING' && Date.now() >= r._confirm_at) {
      r.status = 'CONFIRMED';
      r.updated_at = new Date(r._confirm_at).toISOString();
      changed = true;
    }
  }
  if (changed) save();
}

function checkRateLimit(userId) {
  const windowMs = 10_000;
  const limit = 5;
  const t = Date.now();
  const recent = (attempts.get(userId) || []).filter((x) => t - x < windowMs);
  if (recent.length >= limit) {
    const retryAfter = Math.ceil((windowMs - (t - recent[0])) / 1000);
    fail(429, 'RATE_LIMITED', 'Too many reservation attempts.', { retryAfter });
  }
  recent.push(t);
  attempts.set(userId, recent);
}

export const mockApi = {
  async register({ email, password }) {
    await latency();
    const fields = {};
    if (!/^\S+@\S+\.\S+$/.test(email || '')) fields.email = 'Enter a valid email address.';
    if ((password || '').length < 8) fields.password = 'Use at least 8 characters.';
    if (Object.keys(fields).length) fail(422, 'VALIDATION_ERROR', 'Please check the highlighted fields.', { fields });
    if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      fail(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
    }
    const user = { id: uid('usr'), email, password, role: 'USER' };
    db.users.push(user);
    save();
    return publicUser(user);
  },

  async login({ email, password }) {
    await latency();
    const user = db.users.find((u) => u.email.toLowerCase() === (email || '').toLowerCase() && u.password === password);
    if (!user) fail(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id }));
    } catch {
      /* ignore */
    }
    return { access_token: 'mock-token', token_type: 'bearer', expires_in: 900 };
  },

  async restoreSession() {
    await latency();
    return publicUser(currentUser());
  },

  async logout() {
    await latency();
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  },

  async me() {
    await latency();
    return publicUser(currentUser());
  },

  async listEvents({ page = 1, pageSize = 12 } = {}) {
    await latency();
    const sorted = [...db.events].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const start = (page - 1) * pageSize;
    return { items: sorted.slice(start, start + pageSize).map(summary), page, page_size: pageSize, total: sorted.length };
  },

  async getEvent(id) {
    await latency();
    const e = db.events.find((x) => x.id === id);
    if (!e) fail(404, 'NOT_FOUND', 'Event not found.');
    return { ...summary(e), description: e.description, tiers: e.tiers.map((t) => ({ ...t })) };
  },

  async createReservation({ tierId, qty, idempotencyKey }) {
    await latency();
    const user = currentUser();
    if (!idempotencyKey) fail(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Missing Idempotency-Key header.');

    // A retry with the same key returns the original reservation instead of booking again.
    const idemKey = `${user.id}:${idempotencyKey}`;
    if (db.idempotency[idemKey]) {
      settle();
      return view(db.reservations.find((r) => r.id === db.idempotency[idemKey]));
    }

    checkRateLimit(user.id);

    if (!Number.isInteger(qty) || qty < 1 || qty > 6) {
      fail(422, 'VALIDATION_ERROR', 'Quantity must be between 1 and 6.', { fields: { qty: 'Between 1 and 6.' } });
    }
    const event = db.events.find((e) => e.tiers.some((t) => t.id === tierId));
    if (!event) fail(404, 'NOT_FOUND', 'Ticket tier not found.');
    const tier = event.tiers.find((t) => t.id === tierId);

    // Equivalent of: UPDATE ... SET available = available - qty WHERE available >= qty
    if (tier.available < qty) {
      fail(409, 'SOLD_OUT', tier.available === 0 ? 'This tier is sold out.' : `Only ${tier.available} left in this tier.`);
    }
    tier.available -= qty;

    const r = {
      id: uid('res'), user_id: user.id, event_id: event.id, tier_id: tier.id, qty,
      status: 'PENDING', created_at: now(), updated_at: now(),
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      _confirm_at: Date.now() + 1800 + Math.random() * 1700,
    };
    db.reservations.push(r);
    db.idempotency[idemKey] = r.id;
    save();
    return view(r);
  },

  async getReservation(id) {
    await latency();
    const user = currentUser();
    settle();
    const r = db.reservations.find((x) => x.id === id);
    // 404 (not 403) for other users' reservations, so IDs can't be probed.
    if (!r || (r.user_id !== user.id && user.role !== 'ADMIN')) fail(404, 'NOT_FOUND', 'Reservation not found.');
    return view(r);
  },

  async listMyReservations() {
    await latency();
    const user = currentUser();
    settle();
    const items = db.reservations
      .filter((r) => r.user_id === user.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(view);
    return { items };
  },

  async createEvent(payload) {
    await latency();
    const user = currentUser();
    if (user.role !== 'ADMIN') fail(403, 'FORBIDDEN', 'Admin role required.');
    const e = {
      id: uid('evt'), name: payload.name, venue: payload.venue, starts_at: payload.starts_at,
      status: 'ON_SALE', description: payload.description || '',
      tiers: payload.tiers.map((t) => ({ id: uid('tier'), name: t.name, price_cents: t.price_cents, capacity: t.capacity, available: t.capacity })),
    };
    db.events.push(e);
    save();
    return { ...summary(e), description: e.description, tiers: e.tiers };
  },
};
