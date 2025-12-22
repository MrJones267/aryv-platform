#!/bin/bash

# Run all database migrations in order
echo "Running database migrations..."

echo "Running 001_initial_schema.sql..."
docker exec -i hitch-postgres psql -U hitch_user -d hitch < migrations/001_initial_schema.sql

echo "Running 002_courier_service_schema.sql..."
docker exec -i hitch-postgres psql -U hitch_user -d hitch < migrations/002_courier_service_schema.sql

echo "Running 003_admin_users_table.sql..."
docker exec -i hitch-postgres psql -U hitch_user -d hitch < migrations/003_admin_users_table.sql

echo "Checking final table count..."
docker exec hitch-postgres psql -U hitch_user -d hitch -c "\dt"

echo "Migration complete!"