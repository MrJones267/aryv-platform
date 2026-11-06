-- =====================================================================
-- Migration 038: aryv_app, a restricted role for the API to connect as
-- Author: Oabona-Majoko
-- Created: 2026-11-06
--
-- Purpose:
--   The API connected as `postgres`, a superuser. Any SQL injection would
--   then control the whole server: every table, other databases, and
--   commands on the host (COPY ... TO PROGRAM).
--
--   aryv_app can read and write rows and use sequences in `public`, and
--   nothing else: no DDL, no role or database creation, no superuser.
--   The API never needs more. At startup it only runs
--   `CREATE EXTENSION IF NOT EXISTS postgis`, which is a no-op once the
--   extension exists, and `sequelize.sync()`, which runs only when the
--   tables are missing.
--
--   The role is created NOLOGIN, so no password lives in the repository.
--   Turning it on is a separate, manual step:
--     ALTER ROLE aryv_app LOGIN PASSWORD '<generated>';
--   followed by pointing the API's DATABASE_URL at it.
--
--   Migrations keep running as the owner (postgres), using PostGIS's own
--   DATABASE_URL, not the API's. The default privileges below make every
--   table and sequence a later migration creates usable by aryv_app
--   without another grant.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aryv_app') THEN
    CREATE ROLE aryv_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO aryv_app', current_database());
END
$$;

-- Postgres 15+ already withholds CREATE on public from ordinary roles; say
-- so explicitly rather than rely on the version's default.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO aryv_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aryv_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO aryv_app;

-- Objects later migrations create, as whoever runs them (the owner).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aryv_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO aryv_app;
