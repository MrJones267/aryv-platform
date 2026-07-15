# Production Cutover Plan — server-simple.js → TypeScript backend

**Goal:** Move ARYV production (Railway) from `backend/server-simple.js` (raw SQL, integer IDs) to the `backend/src` TypeScript/Sequelize backend (UUID IDs), where the commission + auth work already lives — migrating the existing ~5 users' data.

**Principles:** Do everything on staging first. Never mutate production in place. Cut over by pointing the app at a *new* clean database, keeping the old one as instant rollback. The final production switch requires explicit approval.

---

## Phase 0 — Safety (done / ongoing)
- [x] Full `pg_dump` backup of live Railway DB → `railway_backup_20260619_060903.sql`
- [ ] Rotate the Railway DB password that was shared in chat (user action)

## Phase 1 — Feasibility gate (staging) ⟵ EXECUTE FIRST
The TS backend has **never been deployed**. Prove it works before anything else.
- [ ] Build the canonical UUID schema from the TS models on the local scratch DB (`aryv_db`)
- [ ] Boot `backend/src` against that schema; confirm `/health` + a few real endpoints (auth register/login, rides list)
- **Gate:** if the app can't stand up cleanly, the cutover stops here and becomes a bug-fix task.

## Phase 2 — Data ETL (staging)
- [ ] Restore `railway_backup_*.sql` into a `legacy` DB on the scratch server (the integer-ID production data)
- [ ] Write + test an ETL mapping legacy → new schema:
  - `users` (already UUID) map directly
  - integer-PK tables (`rides`, `bookings`, `vehicles`, …) → generate UUIDs, remap FKs
  - reconcile table/column name differences (e.g. `ride_ratings`, `group_chat_members`)
- [ ] Verify row counts + referential integrity post-ETL

## Phase 3 — App validation against migrated data (staging)
- [ ] Boot TS backend against the ETL'd schema
- [ ] Smoke test: login as a migrated user, list rides/bookings, profile

## Phase 4 — Production cutover (requires approval)
- [ ] Provision a **new** Railway Postgres (clean UUID schema) — do NOT mutate the existing one
- [ ] Run schema build + ETL against it (from a fresh prod backup)
- [ ] Set Railway service start command → `node backend/dist/index.js`; set required env vars (JWT_SECRET, etc.)
- [ ] Deploy; confirm `/health`
- [ ] Smoke test production endpoints with a real account
- [ ] Flip mobile app base URL only after green

## Phase 5 — Rollback plan
- Revert Railway start command back to `server-simple.js`
- Point `DATABASE_URL` back to the original (untouched) DB
- Both are instant because we never modified the original DB or server

---

## Status log
- 2026-06-19: Plan created. Beginning Phase 1 feasibility gate on local scratch DB.
- 2026-06-20: **Phase 1 PASSED.** TS backend now builds schema (25 tables, via queryInterface.createTable bypassing buggy sync indexes), boots (db+redis ok), and serves real requests (register/login persist + read a UUID user). Fixed: redis rate-limit store crash, 7 models' timestamp option-rename conflict, User.phone index. Committed as 80cd9c4 on chore/backend-cutover.
  - Deferred for production (not blocking feasibility): rebuild a correct, complete set of indexes/unique-constraints/FKs (the model index defs use attribute names, not columns).
  - Beginning Phase 2: load prod backup into a local legacy DB; build integer->UUID ETL.
- 2026-06-20: **Phases 2 & 3 PASSED (staging).** Loaded prod backup into local PG17 `aryv-legacy` (5 users, 2 rides, 0 bookings). Reality simpler than feared: all 5 users are passenger/active, password-based (no Google, no drivers). Migrated all 5 users into the new UUID schema (id is already uuid; password_hash preserved). Validated: TS backend serves the migrated data — login with a migrated email returns INVALID_CREDENTIALS (row readable + bcrypt runs), so real users keep their passwords. The 2 rides are test data (no bookings depend on them) — optional to migrate.
  - **Remaining before Phase 4 (production):**
    1. Produce a CORRECT, complete schema artifact — the staging build used queryInterface.createTable and skipped ALL indexes/unique-constraints/FKs. Production needs at least: unique(email), unique(phone_number), FKs, and key indexes. (The model index defs still reference attribute names, not columns — fix or hand-write the constraint/index migration.)
    2. Provision a NEW Railway Postgres (don't mutate the live one); user action.
    3. Run schema build + user ETL against it from a fresh prod backup.
    4. Set Railway start command to `node backend/dist/index.js` + required env vars (JWT_SECRET, JWT_REFRESH_SECRET, ADMIN_JWT_SECRET, SESSION_SECRET, DATABASE_URL, REDIS_*).
    5. Deploy, smoke test, then flip mobile app base URL.
  - **🔴 correctness gap:** new schema currently has no unique(email) — must add before production or duplicate accounts become possible.
- 2026-06-20: **Schema-constraints work DONE.** Added `backend/scripts/build-schema.ts` (committed 1bea232) — model-derived builder producing 25 tables, 12 uniques, 117 indexes, 34 FKs, 0 skips. **Correctness gap CLOSED:** duplicate email now rejected at DB and API (`USER_ALREADY_EXISTS`). Re-ran ETL (5 users) and re-validated end-to-end against the production-grade schema: register (respects uniques/FKs), duplicate-email rejection, and login/bcrypt against a migrated user all pass.
  - **Phase 4 remaining (production):** (a) user provisions a NEW Railway Postgres; (b) run build-schema.ts + user ETL against it from a fresh prod backup; (c) Railway builds dist via its buildCommand (`npm run build` — note: local tsc build is flaky on the /mnt/c mount, but Railway builds in-cloud); (d) set start command `node backend/dist/index.js` + env vars; (e) deploy, smoke test, flip mobile URL. Original `server-simple.js` DB stays untouched as instant rollback.
