.PHONY: help build up down restart logs clean install dev

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build all Docker containers
	docker-compose build

up: ## Start all services
	docker-compose up -d

down: ## Stop all services
	docker-compose down

restart: ## Restart all services
	docker-compose restart

logs: ## Show logs from all services
	docker-compose logs -f

logs-backend: ## Show backend logs
	docker-compose logs -f backend

logs-frontend: ## Show frontend logs
	docker-compose logs -f frontend

logs-db: ## Show database logs
	docker-compose logs -f postgres

clean: ## Stop services and remove volumes
	docker-compose down -v

install: ## Install dependencies locally (not in Docker)
	npm install
	cd frontend && npm install
	cd backend && npm install

dev: ## Run development servers locally (not in Docker)
	npm run dev

db-shell: ## Access PostgreSQL shell
	docker-compose exec postgres psql -U postgres -d series_db

db-reset: ## Reset database (drop and recreate)
	docker-compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS series_db;"
	docker-compose exec postgres psql -U postgres -c "CREATE DATABASE series_db;"

