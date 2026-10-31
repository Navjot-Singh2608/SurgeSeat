# SurgeSeat frontend

Minimal React (Vite) client for SurgeSeat. It is intentionally small: the point of the
project is the backend. It talks to the API described in `../docs/api-contract.md`.

## Run it

```bash
cd frontend
npm install

npm run dev:mock   # no backend needed: uses an in-browser mock API
npm run dev        # real backend: proxies /api to http://localhost:8000
```

Open http://localhost:5173.

Mock accounts: `user@surgeseat.dev` / `user12345` and `admin@surgeseat.dev` / `admin1234`.
The mock keeps its data in sessionStorage, so closing the tab resets it.

To point at a different backend (for example NGINX on port 80), copy `.env.example`
to `.env.local` and set `VITE_PROXY_TARGET`.

## Pages

| Route | Who | What |
|---|---|---|
| `/events` | anyone | Paginated event list (approximate availability) |
| `/events/:id` | anyone (reserve needs login) | Tiers, quantity, Reserve |
| `/reservations/:id` | owner | Live status: polls until CONFIRMED / EXPIRED / FAILED |
| `/reservations` | logged in | My reservations |
| `/admin/events/new` | ADMIN | Create an event with tiers |
| `/login`, `/register` | anyone | Auth |

## Behaviour the backend must support

These are the parts of the UI that exercise the system-design work:

- **Access token in memory, refresh token as httpOnly cookie.** On reload the app calls
  `POST /auth/refresh` to restore the session. On any 401 it refreshes once (shared across
  concurrent requests) and retries.
- **Idempotency-Key on every reservation.** One key per logical attempt. After a network error
  or 5xx the same key is reused, so a retry can never double-book. A new key is generated after
  a definite answer or when tier/quantity changes.
- **202 + polling.** `POST /reservations` returns `PENDING`; the page polls
  `GET /reservations/{id}` with backoff (1s growing to 5s, giving up after 90s) while the
  Kafka worker confirms it.
- **409 SOLD_OUT** refreshes availability. **429** shows a countdown from `Retry-After`.
- **Role checks in the UI are cosmetic.** The backend must enforce them.

## Structure

```
src/
  api/          client.js (fetch, tokens, refresh), real.js (endpoints), mock.js, errors.js
  auth/         AuthContext (session state), ProtectedRoute (login/role gate)
  components/   Navbar, Spinner, ErrorMessage, StatusBadge
  pages/        one file per route
  utils/        formatting, uuid
```

## Docker

`Dockerfile` builds the static site and serves it from a small NGINX image. In the full stack
the main load balancer in `infra/nginx` can serve the built files directly instead.
