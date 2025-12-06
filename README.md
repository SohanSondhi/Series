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

Services are available locally here:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5001
- **PostgreSQL**: localhost:5432
- **Ollama (LLM)**: http://localhost:11434
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

# Twitter API (optional - for Twitter routes)
TWITTER_BEARER_TOKEN=your_twitter_bearer_token_here

# LLM API (optional - for generating recaps from tweets)
# Default: Llama via Ollama (runs in Docker, no API key required)
LLM_PROVIDER=llama  # Options: 'llama', 'ollama', 'openai'
LLM_BASE_URL=http://ollama:11434  # Ollama base URL (use 'ollama' service name in Docker)
LLM_MODEL=llama3.2  # Llama model name (default: llama3.2)
# Note: If running locally (not in Docker), use http://localhost:11434

# Alternative: OpenAI (if LLM_PROVIDER=openai)
# OPENAI_API_KEY=your_openai_api_key_here
# OPENAI_MODEL=gpt-4o-mini  # Recommended: gpt-4o-mini (cost-effective) or gpt-4o (more capable)
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

in root directory

2. Pull a Llama model for Ollama (first time only):

```bash
docker exec series_ollama ollama pull llama3.2
# Or use another model: docker exec series_ollama ollama pull llama3.1
```

3. Start all services (including the Kafka ingestor and Ollama):

```bash
docker-compose up
```

The Kafka ingestor will automatically start and connect to Kafka. You can also start just the ingestor:

```bash
docker-compose up kafka-ingestor
```
