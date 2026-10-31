# SurgeSeat

High-performance distributed event ticket reservation system.
Skeleton only — components are added step by step.

## Layout

| Folder | Purpose |
|---|---|
| `backend/` | Async FastAPI service (stateless, horizontally scaled) |
| `backend/app/api/v1` | HTTP routes |
| `backend/app/core` | Config, settings, startup |
| `backend/app/auth` | JWT, OAuth 2.0 / OIDC, RBAC |
| `backend/app/models` | Database models (PostgreSQL) |
| `backend/app/schemas` | Request/response schemas |
| `backend/app/repositories` | Data access layer |
| `backend/app/services` | Business logic (reservations, inventory) |
| `backend/app/cache` | Redis caching |
| `backend/app/messaging` | Kafka producers |
| `backend/app/middleware` | Rate limiting, request IDs, etc. |
| `backend/app/observability` | Prometheus metrics, logging |
| `backend/migrations` | Database migrations |
| `workers/` | Kafka consumers / background jobs (e.g. confirmations) |
| `frontend/` | Minimal React app |
| `infra/nginx` | Load balancer config |
| `infra/postgres`, `infra/redis`, `infra/kafka` | Service configs / init scripts |
| `infra/prometheus`, `infra/grafana` | Monitoring |
| `infra/k8s` | Optional local Kubernetes (kind / Minikube) |
| `load-tests/k6` | k6 scenarios; `results/` for measured runs |
| `docs/` | Architecture notes, ADRs, benchmarks |
| `scripts/` | Dev helper scripts |
| `.github/workflows` | CI (free tier) |

Constraint: $0 budget — open-source, local-first tooling only.
