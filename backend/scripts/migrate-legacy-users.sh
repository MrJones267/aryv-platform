#!/usr/bin/env bash
#
# migrate-legacy-users.sh — migrate user accounts from the legacy server-simple.js
# database (integer/mixed-ID schema) into the new TypeScript-backend UUID schema.
#
# Context: production used backend/server-simple.js. The cutover moves to the
# backend/src TypeScript app, whose schema is built by scripts/build-schema.ts.
# users.id is already a UUID in the legacy DB, and password_hash is carried over
# verbatim so existing passwords keep working. Verified for the real dataset:
# all users are passenger/active and password-based (no Google, no drivers).
#
# Idempotent: ON CONFLICT (id) DO NOTHING — safe to re-run.
#
# Usage:
#   SOURCE_URL="postgresql://user:pass@legacy-host:5432/legacydb" \
#   TARGET_URL="postgresql://user:pass@new-host:5432/newdb" \
#   ./scripts/migrate-legacy-users.sh
#
# Both SOURCE_URL and TARGET_URL must be reachable by `psql`. Run build-schema.ts
# against TARGET_URL first so the destination schema exists.
#
# @author Oabona-Majoko
# @created 2026-06-20
set -euo pipefail

: "${SOURCE_URL:?Set SOURCE_URL to the legacy database connection string}"
: "${TARGET_URL:?Set TARGET_URL to the new (UUID-schema) database connection string}"

TMP_SQL="$(mktemp /tmp/users_etl.XXXXXX.sql)"
trap 'rm -f "$TMP_SQL"' EXIT

echo "[1/3] Generating user INSERTs from legacy source..."
# Column mapping legacy -> new. %L emits safe SQL literals (incl. NULL).
# Notable mappings: new.is_verified <- legacy.is_email_verified.
psql "$SOURCE_URL" -tAc "
SELECT format(
'INSERT INTO users (id,email,password_hash,phone_number,first_name,last_name,role,status,profile_image,date_of_birth,is_verified,is_phone_verified,last_login,refresh_token,country_code,country_name,timezone,rating,passenger_rating,created_at,updated_at) VALUES (%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L) ON CONFLICT (id) DO NOTHING;',
id,email,password_hash,phone_number,first_name,last_name,role,status,profile_image,date_of_birth,is_email_verified,is_phone_verified,last_login,refresh_token,country_code,country_name,timezone,rating,passenger_rating,created_at,updated_at)
FROM users ORDER BY created_at;" > "$TMP_SQL"

COUNT="$(grep -c 'INSERT INTO users' "$TMP_SQL" || true)"
echo "      generated ${COUNT} user rows"

echo "[2/3] Applying to target..."
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -f "$TMP_SQL" >/dev/null
echo "      applied"

echo "[3/3] Verifying..."
SRC="$(psql "$SOURCE_URL" -tAc 'SELECT COUNT(*) FROM users')"
DST="$(psql "$TARGET_URL" -tAc 'SELECT COUNT(*) FROM users')"
echo "      source users=${SRC}  target users=${DST}"
if [ "$SRC" != "$DST" ]; then
  echo "WARNING: source and target user counts differ — review before cutover." >&2
fi
echo "Done."
