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

## Quick Start

### Using Makefile (Recommended)

```bash
# Build and start all services
make build
make up

# View logs
make logs

# Stop services
make down

# Clean everything (including volumes)
make clean
```

### Using Docker Compose Directly

```bash
# Build containers
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Services will be held locally here:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **PostgreSQL**: localhost:5432

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
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=series_db
DB_USER=postgres
DB_PASSWORD=postgres
```

### Frontend

Create a `.env` file in the `frontend/` directory if needed:

```env
VITE_API_URL=http://localhost:5000
```

## Database Setup

This project uses **Drizzle ORM** for type-safe database operations.

### Initial Setup

After starting the services, run the database migration:

```bash
# From the backend directory
cd backend
npm run db:migrate
```

This will automatically create the `users` table based on the schema defined in `backend/src/db/schema.ts`.

### Database Commands

- `npm run db:migrate` - Push schema changes to database (development)
- `npm run db:generate` - Generate migration files (production)
- `npm run db:check` - Check for schema changes
