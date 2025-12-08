# Series Hax Project

<img width="794" height="483" alt="Series UI screenshot" src="https://github.com/user-attachments/assets/8fe99e47-238c-4542-a9de-9a195c02a0e2" />

Series pairs a React/Vite frontend with an Express/TypeScript backend, PostgreSQL, and a Kafka ingestor for streaming messages into the app. An LLM provider (Ollama by default) is used for text generation/recaps.

---

## Demo

- [Demo Video](demo.MOV)
- YouTube: https://www.youtube.com/watch?v=kEuqcATzOWE

## Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Express + TypeScript
- **Database:** PostgreSQL 16 with Drizzle ORM
- **Streaming:** Kafka ingestor (separate service)
- **LLM:** Ollama by default (can swap providers)
- **Containerization:** Docker & Docker Compose

## Pipeline

- Kafka ingestion -> Twitter import -> LLM recap -> Series API to send automated messages

## Services & Ports

- Frontend: http://localhost:3000
- Backend API: http://localhost:5001
- PostgreSQL: localhost:5432
- LLM (host-level Ollama by default): http://localhost:11434
- Kafka ingestor: runs as its own container (no exposed port)

## Repo Structure

```
Series/
├── assets/               # Screenshots and branding
├── backend/              # Express API, Drizzle schema, Kafka ingestor
│   ├── src/
│   │   ├── db/           # Drizzle schema, migrate/seed helpers
│   │   ├── kafka/        # Ingestor entry + Kafka helpers
│   │   └── routes/       # messages, profile, twitter, users, wrapped, send
│   ├── scripts/start.sh  # Wait for DB, run migrations + seed, start dev server
│   ├── Dockerfile
│   └── package.json
├── frontend/             # React/Vite app
│   ├── src/
│   │   ├── components/   # Pages (Profile, Messages, Wrapped) + modals
│   │   ├── components/UI # Animations, particles, graph effects
│   │   └── utils/        # User helpers/types
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml    # Orchestrates postgres, backend, frontend, ingestor
├── Makefile              # Convenience targets for Docker/dev workflows
└── README.md
```

## Prereqs

- Docker + Docker Compose (recommended path)
- Node.js 20+ (if running locally without Docker)
- Make (optional, for Makefile shortcuts)

## Quick Start (Docker)

1. Create a root `.env` (in the repo root):

   ```env
   DB_PASSWORD=postgres            # required
   LLM_PROVIDER=llama              # optional override
   LLM_BASE_URL=http://host.docker.internal:11434
   LLM_MODEL=llama3.2

   # Kafka (only if using the ingestor)
   KAFKA_CLIENT_ID=
   KAFKA_BROKERS=
   KAFKA_CONSUMER_GROUP=
   KAFKA_TOPIC=
   KAFKA_SASL_USERNAME=
   KAFKA_SASL_PASSWORD=
   KAFKA_SASL_MECHANISM=plain
   KAFKA_TLS_ENABLED=true
   KAFKA_FROM_BEGINNING=false

   # Optional API config for ingestor → Series API
   SERIES_API_BASE=
   SERIES_API_KEY=
   SENDER_NUMBER=
   ```

2. Start everything:
   ```bash
   docker-compose up --build
   ```
   The backend waits for Postgres, runs migrations, seeds sample data, and starts the dev server.
3. If using Ollama locally, ensure `ollama serve` is running and pull a model (e.g., `ollama pull llama3.2`).

## Getting Started (Docker)

If you prefer detached mode and tailing logs:

```bash
docker-compose up -d
docker-compose logs -f
```

## Running Locally (without Docker)

Prereqs: PostgreSQL running locally, Node.js 20+, and an `.env` in each app.

Backend (`backend/.env`):

```env
NODE_ENV=development
PORT=5001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=series_db
DB_USER=postgres
DB_PASSWORD=postgres

# LLM (defaults shown for local Ollama)
LLM_PROVIDER=llama
LLM_BASE_URL=http://localhost:11434
LLM_MODEL=llama3.2

# Twitter API (optional)
TWITTER_BEARER_TOKEN=
```

Run backend locally:

```bash
cd backend
npm install
npm run db:migrate    # create/update tables
npx tsx src/db/seed.ts || true
npm run dev
```

Frontend (`frontend/.env`):

```env
VITE_API_URL=http://localhost:5001
VITE_SENDER_NUMBER=            # optional, for messaging UI
```

Run frontend locally:

```bash
cd frontend
npm install
npm run dev -- --host
```

Kafka ingestor (local):

```bash
cd backend
npm run kafka:ingest   # requires Kafka + DB env set above
```

## Makefile Shortcuts

- `make build` / `make up` / `make down` / `make clean`
- `make logs`, `make logs-backend`, `make logs-frontend`, `make logs-db`
- `make install` to install deps locally; `make db-shell` for psql

## Database & Migrations

- Docker flow: migrations run automatically on backend startup via `scripts/start.sh`, and the seed script populates sample data.
- Local flow: use `npm run db:migrate` after changing the schema; `npm run db:generate` to emit migration files; `npm run db:check` to detect drift.

## Kafka Ingestor

- In Docker: `docker-compose up kafka-ingestor` (starts alongside backend/DB).
- Locally: `npm run kafka:ingest` from `backend` with Kafka + DB env set.
- Configure Kafka and Series API credentials in the root `.env` (Docker) or `backend/.env` (local) using the variables listed above.

## Compatibility Notes

- The backend startup script (`backend/scripts/start.sh`) is tested on macOS with Docker; Linux users may need to adjust the `pg_isready` wait loop or executable permissions depending on their distro/shell defaults.
- Ollama path: the default `LLM_BASE_URL` assumes Ollama is on the host at `http://host.docker.internal:11434` (Docker) or `http://localhost:11434` (local). Update the URL if your LLM host differs.
- Node 20+ is required for local runs; earlier Node versions are unsupported.
