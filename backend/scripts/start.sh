#!/bin/sh
set -e

echo "⏳ Waiting for database to be ready..."
export PGPASSWORD="$DB_PASSWORD"
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; do
  echo "Database is unavailable - sleeping"
  sleep 1
done

echo "✅ Database is ready!"

echo "🔄 Running database migrations..."
npm run db:migrate

echo "🌱 Seeding database with test data..."
npx tsx src/db/seed.ts || echo "⚠️ Seed failed or already seeded, continuing..."

echo "🚀 Starting server..."
exec npm run dev

