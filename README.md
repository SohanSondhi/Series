# Series Hax Project

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + Node.js + TypeScript
- **Database**: PostgreSQL 16
- **ORM**: Drizzle ORM
- **Containerization**: Docker & Docker Compose

## Prereqs

- Docker and Docker Compose installed
- Make (optional, for using Makefile commands)
- Node.js 20+ (if running locally without Docker)

### Quick Start

```bash
# Build containers
docker-compose build

docker-compose up

# Stop services
docker-compose down
```

Services are held locally here:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5001
- **PostgreSQL**: localhost:5432
- **Kafka Ingestor**: Runs as a separate container (no exposed port)

## Repo Structure

```
Series/
├── frontend/          # React + TypeScript frontend
│   ├── src/
│   ├── package.json
│   └── Dockerfile
├── backend/           # Express + Node.js backend
│   ├── src/
│   │   ├── db/       # Database configuration
│   │   └── index.ts  # Express server
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml # Docker orchestration
├── Makefile          # Convenient commands
└── README.md
```

## Environment Variables

### Backend

Create a `.env` file in the `backend/` directory:

```env
NODE_ENV=development
PORT=5001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=series_db
DB_USER=postgres
DB_PASSWORD=postgres
```

### Frontend

Create a `.env` file in the `frontend/` directory if needed:

```env
VITE_API_URL=http://localhost:5001
```

### Initial Setup

**Migrations run automatically** when the backend container starts! The startup script will:

1. Wait for the database to be ready
2. Run Drizzle migrations to create/update tables
3. Start the Express server

No manual migration step needed when using Docker! 🎉

If running locally (without Docker), you can still run migrations manually:

```bash
cd backend
npm run db:migrate
```

### Database Commands

- `npm run db:migrate` - Push schema changes to database (development)
- `npm run db:generate` - Generate migration files (production)
- `npm run db:check` - Check for schema changes

### Kafka Message Ingestor - Env File

```env
# Kafka Configuration (for message ingestion)
KAFKA_CLIENT_ID=''
KAFKA_BROKERS=''
KAFKA_CONSUMER_GROUP=''
KAFKA_TOPIC=''
KAFKA_SASL_USERNAME=''
KAFKA_SASL_PASSWORD=''
KAFKA_SASL_MECHANISM=plain
KAFKA_TLS_ENABLED=true
KAFKA_FROM_BEGINNING=false
```
in root directly

2. Start all services (including the Kafka ingestor):

```bash
docker-compose up
```

The Kafka ingestor will automatically start and connect to Kafka. You can also start just the ingestor:

```bash
docker-compose up kafka-ingestor
```
