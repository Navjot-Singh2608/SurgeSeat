# SurgeSeat API contract (v1)

The frontend is built against this contract. The FastAPI backend should implement it exactly;
change this file first if the contract needs to change.

- Base path: `/api/v1`
- Content type: JSON
- Auth: `Authorization: Bearer <access_token>` (JWT, ~15 min)
- Refresh token: httpOnly, Secure, SameSite=Strict cookie, path `/api/v1/auth`, set by login/refresh
- IDs: strings. Timestamps: ISO 8601 UTC. Money: integer cents (`price_cents`), CAD.

## Errors

```json
{ "detail": { "code": "SOLD_OUT", "message": "This tier is sold out.", "fields": null } }
```

FastAPI's default `{"detail": "..."}` and Pydantic 422 arrays are also handled by the UI,
but the structured form is preferred.

| Status | code | When |
|---|---|---|
| 400 | IDEMPOTENCY_KEY_REQUIRED | Reservation without the header |
| 401 | UNAUTHORIZED / INVALID_CREDENTIALS | Missing/expired token, bad login |
| 403 | FORBIDDEN | Role not allowed |
| 404 | NOT_FOUND | Missing, or not yours (never 403 for other users' reservations) |
| 409 | SOLD_OUT / EMAIL_TAKEN | Not enough tickets / duplicate email |
| 422 | VALIDATION_ERROR | `fields` maps field name to message |
| 429 | RATE_LIMITED | Include `Retry-After` header (seconds) |
| 503 | UNAVAILABLE | Dependency down; include `Retry-After` if known |

## Auth

### POST /auth/register
Request `{ "email": "a@b.com", "password": "min 8 chars" }`
Response `201 { "id", "email", "role": "USER" }`

### POST /auth/login
Request `{ "email", "password" }`
Response `200 { "access_token", "token_type": "bearer", "expires_in": 900 }` and sets the refresh cookie.

### POST /auth/refresh
No body; uses the cookie. Rotates the refresh token (new cookie).
Response `200` same shape as login. `401` if the cookie is missing, expired or reused.

### POST /auth/logout
Revokes the refresh token and clears the cookie. Response `204`.

### GET /auth/me
Response `200 { "id", "email", "role": "USER" | "ADMIN" }`

## Events

### GET /events?page=1&page_size=12
Public. Cacheable (Redis, short TTL).
```json
{
  "items": [
    { "id", "name", "venue", "starts_at", "status": "ON_SALE",
      "min_price_cents": 6900, "available": 2853 }
  ],
  "page": 1, "page_size": 12, "total": 4
}
```

### GET /events/{id}
Public.
```json
{ "id", "name", "venue", "starts_at", "status", "description",
  "min_price_cents", "available",
  "tiers": [ { "id", "name", "price_cents", "capacity", "available" } ] }
```

## Reservations

### POST /reservations
Auth required. Header `Idempotency-Key: <uuid>` required.
Request `{ "tier_id": "...", "qty": 1 }` (qty 1 to 6)
Response `202`:
```json
{ "id", "status": "PENDING", "event_id", "event_name", "tier_id", "tier_name",
  "qty", "total_price_cents", "created_at", "updated_at", "expires_at" }
```
Same key + same user returns the original reservation (200 or 202), never a second booking.
Errors: 409 SOLD_OUT, 429 RATE_LIMITED, 422.

### GET /reservations/{id}
Owner or ADMIN. Same shape as above. `status` is one of
`PENDING | CONFIRMED | EXPIRED | FAILED | CANCELLED`.

### GET /me/reservations
`200 { "items": [ <reservation>, ... ] }`, newest first.

## Admin

### POST /admin/events
ADMIN only.
```json
{ "name", "venue", "starts_at", "description",
  "tiers": [ { "name", "price_cents", "capacity" } ] }
```
Response `201` with the event detail shape. Invalidate the events cache.

## Health (not under /api/v1 auth)

- `GET /health` liveness: process is up
- `GET /ready` readiness: PostgreSQL (and later Redis) reachable
- `GET /metrics` Prometheus
