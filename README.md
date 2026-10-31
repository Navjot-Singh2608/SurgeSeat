# SurgeSeat

Event Ticket Reservation System - load balancing, caching, async messaging, rate limiting and observability.

## What is this?

SurgeSeat is a ticket booking app where users can sign up, browse events and reserve tickets.

The app itself is intentionally simple. The real goal is the backend: learning and showing how large systems
stay fast and correct when thousands of people try to book the same tickets at the same time —
without overselling or double-booking.

## Tech stack

| Area | Tools |
|---|---|
| Backend | Python, FastAPI (async) |
| Database | PostgreSQL, SQLAlchemy, Alembic |
| Cache & rate limiting | Redis |
| Messaging | Apache Kafka |
| Load balancer | NGINX |
| Monitoring | Prometheus, Grafana |
| Load testing | k6 |
| Frontend | React |
| Infrastructure | Docker, Docker Compose |

## Status

🚧 Work in progress, built step by step.

- [x] Docker setup, FastAPI health checks, PostgreSQL, migrations
- [x] React frontend (with a mock API)
- [ ] Authentication (JWT, roles)
- [ ] Events and reservations
- [ ] Monitoring
- [ ] Load balancing across multiple API instances
- [ ] Redis caching and rate limiting
- [ ] Kafka background processing
- [ ] Load and failure testing

## Run it locally

Requires Docker Desktop.

```bash
cp .env.example .env        # then set your own password
docker compose up -d --build
```

- API health: http://localhost:8000/ready
- API docs: http://localhost:8000/docs

Frontend (optional):

```bash
cd frontend
npm install
npm run dev:mock            # runs without the backend
```

Open http://localhost:5173

## Project structure

```
backend/      FastAPI service
workers/      Kafka background workers
frontend/     React app
infra/        NGINX, Prometheus, Grafana, Kubernetes configs
load-tests/   k6 scripts and results
docs/         Architecture notes and API contract
```
