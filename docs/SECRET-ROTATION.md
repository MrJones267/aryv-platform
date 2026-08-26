# Secret rotation

## Why

`aryv-platform` is a **public** GitHub repository. From **2025-12-22** it tracked
eight environment files that held real, high-entropy credentials:

```
.env.production                     .env.production.secure
backend/.env.production             backend/.env.production.secure
admin-panel/.env.production         admin-panel/.env.production.secure
mobile-app/.env.production          mobile-app/.env.production.secure
```

They were untracked on 2026-08-24, but **git history still contains them** and the
repository has been public for eight months. Public repositories are crawled
continuously by credential scanners; assume every value below was collected
within minutes of being pushed.

Untracking is not remediation. Rotation is.

## What must be rotated

Ordered by what an attacker can do with it today.

### 1. Immediate — these grant access right now

| Secret | Where it lives | Why it matters |
|---|---|---|
| `JWT_SECRET` | Railway → `aryv-platform` | Signs user sessions. Anyone holding it can mint a token for **any** user id and act as them — no password needed. |
| `JWT_REFRESH_SECRET` | Railway | Same, and survives access-token expiry. |
| `ADMIN_JWT_SECRET` | Railway | Signs **admin** tokens. This is the whole admin panel: user data, ride records, commission settings, manual payment release. |
| `SESSION_SECRET` | Railway | Session integrity. |
| `CLOUDFLARE_R2_ACCESS_KEY` / `CLOUDFLARE_R2_SECRET_KEY` | Cloudflare → R2 → Manage API tokens | Read/write/delete on the buckets (`aryv-uploads`, `aryv-app-platform-bucket`). Driver licences and ID documents live here. |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys | Can charge cards and move money. Roll it in the Stripe dashboard, which revokes the old key immediately. |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks | Lets someone forge "payment succeeded" events. |
| `TWILIO_AUTH_TOKEN` | Twilio → Account → API keys | Sends SMS on your account and at your cost. **This one is doubly exposed** — it also sits in `mobile-app/.env`, which has no business holding a server credential at all. |

### 2. Same day

| Secret | Where |
|---|---|
| `POSTGRES_PASSWORD` | Railway → PostGIS service → rotate, then update `DATABASE_URL` |
| `REDIS_PASSWORD` / `REDIS_URL` | Railway → Redis service |
| `QR_CODE_SECRET` | Railway. Signs courier handover codes — a forged one collects someone's parcel. |
| `GOOGLE_MAPS_API_KEY`, `GOOGLE_PLACES_API_KEY`, `GOOGLE_GEOCODING_API_KEY` | Google Cloud Console → Credentials. Billed per call; an exposed key is someone else's free quota on your invoice. Restrict by referrer/package as well as rotating. |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth client |
| `SENTRY_DSN` | Sentry → Project settings. Low severity: a DSN only allows writing events. Rotate for noise, not breach. |

### 3. Verify rather than rotate

- `STRIPE_PUBLISHABLE_KEY` — publishable keys are meant to be public. No action.
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in `backend/.env.production.secure` — low entropy, look like placeholders. Confirm they were never real, then delete the lines.

## Evidence this is not theoretical

The production API's deploy logs show automated probes for `GET /.env`,
`GET /.env.local` and `GET /.git/HEAD`, returning 404 each time. Those are
credential scanners, and they are already pointed at `api.aryv-app.com`. The
404s mean they found nothing at those paths — but the same class of tooling
watches public repositories, and this one has been public throughout.

As of 2026-08-26 the Railway service still holds un-rotated values for
`JWT_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_JWT_SECRET`, `SESSION_SECRET`,
`QR_CODE_SECRET`, `POSTGRES_PASSWORD` and `TWILIO_AUTH_TOKEN`. `R2_*` is not
set at all, so uploads are landing on ephemeral disk right now.

## How to rotate on Railway

Railway holds the live values; the repo files were redundant copies.

```bash
# One secret
railway variables --service aryv-platform --set 'JWT_SECRET=<new value>'

# Generate a strong one
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Setting a variable triggers a redeploy. Expect two consequences:

- **Rotating `JWT_SECRET` or `JWT_REFRESH_SECRET` signs every user out.** Tokens
  signed with the old secret stop verifying. This is the point — it also evicts
  anyone who minted themselves a token. Do it deliberately, not during a peak.
- **Rotating `ADMIN_JWT_SECRET` signs out the admin panel.** Log back in after.

## After rotating

1. **Check for use you did not authorise, in the window since 2025-12-22:**
   - Stripe → Payments, for charges you cannot account for.
   - Twilio → Monitor → Logs, for SMS you did not send. This is the most commonly
     abused of the set, because SMS pumping pays the attacker directly.
   - Cloudflare → R2 → metrics, for reads of documents that were never requested
     through the app.
   - Google Cloud → APIs → Metrics, for call volume that does not match your users.
2. **Consider whether history needs purging.** `git filter-repo` can strip the
   files from every commit, but it rewrites every hash and breaks existing clones
   and open PRs. Given the values are rotated and were public for eight months,
   purging removes little real risk. Prefer rotation; purge only if a compliance
   requirement demands it.
3. **Consider making the repository private** if it does not need to be public.
   That does not undo the exposure, but it stops the next one.

## Preventing a repeat

- `.gitignore` now excludes `.env.production*`, `*.secure`, and database dumps.
- Only `*.example` files — which hold no values — belong in version control.
- Enable **GitHub secret scanning with push protection** (Settings → Code security).
  It blocks a commit containing a recognised credential format before it lands.
- Never put a server credential in `mobile-app/`. Anything shipped in an app
  binary is readable by anyone who downloads it; `TWILIO_AUTH_TOKEN` there was
  the clearest instance.

---

## Addendum — 2026-08-25 security sweep

The sweep removed 30 tracked files that carried credentials in source. Those
values were in a **public** repository for as long as the files were, so they
are exposed on exactly the same terms as the environment files above, and the
same rule applies: deleting them is not remediation, rotation is.

### Credentials to invalidate

| Value | Was in | Action |
|---|---|---|
| `admin@aryv-app.com` / `admin123` | `admin-worker.js`, `admin-professional*.js`, `admin-react-worker.js`, `react-admin-simple.html`, `test-admin-db.html`, `backend/admin-server.js`, and pre-filled into the live admin panel's login form | If an account with this address exists, **change its password now** and check `admin_users.last_login_at` for logins you cannot account for. The password was displayed on screen by the deployed admin panel. |
| `admin@hitch.com` / `admin123`, `user@hitch.com` / `user123`, `driver@hitch.com` / `driver123` | `realtime-server.js`, `simple-server.js` | Mock accounts. Confirm none exists in the real `users` table; delete if it does. |
| Postgres password `5PMs531kv…` for `hitch_user@hitch_db` | `backend/test-db-fixed.js` | Rotate if that database still exists anywhere reachable. It was a local Docker credential, but it is a real password and it was public. |
| `JWT_SECRET = 'test-secret-key'` | `admin-server.js` | Not used by the deployed backend, which requires `JWT_SECRET` from the environment. No action beyond the removal, unless that file was ever run somewhere reachable. |
| `JWT_SECRET` fallback `'your-super-secret-jwt-key'` | `realtime-production-server.js` | Removed — the service now refuses to start without a real secret. If it ever ran without `JWT_SECRET` set, every token it accepted was signed with a published default; treat any session it granted as untrusted. |

### Google Maps key — restriction matters more than rotation

`AIzaSyBoVOEytCKTTsGsOObKdvzFuyxH-UXO8u8` is in `mobile-app/src/config/api.ts`,
`android/app/src/main/res/values/strings.xml` and `ios/aryv/Info.plist`.

It has to ship: the native Maps SDKs read it from the manifest and the plist, and
anything in an app binary is extractable. Concealment is not available, so the
control is restriction:

1. Google Cloud Console → Credentials → this key → **Application restrictions**
   - Android: package name + release signing SHA-1
   - iOS: bundle identifier
2. **API restrictions** → only Maps SDK, Places, Geocoding.
3. **Quotas** → set a daily cap, so a leak becomes a capped bill rather than an
   open one.
4. Then rotate, since the current value has been public and unrestricted.

Only after restriction is in place is rotation worth doing — rotating an
unrestricted key just publishes a new unrestricted key.

### Still outstanding

- `mobile-app/.env` holds `TWILIO_AUTH_TOKEN`. A server credential must never be
  in an app bundle. Remove it from that file and rotate it in Twilio.
- The repository is public. Everything above assumes an attacker has had the
  values since the day they were pushed.

---

## URGENT — seeded administrator accounts (found 2026-08-25)

`backend/migrations/003_admin_users_table.sql` seeds two accounts:

| Email | Role | Permissions |
|---|---|---|
| `admin@aryv-app.com` | `super_admin` | `["*"]` |
| `moderator@aryv-app.com` | `moderator` | users, disputes, analytics |

Both were given the bcrypt hash
`$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm`, and the comment
on the line above it states what it hashes: **`admin123`**.

Migration 003 has been applied to every environment. Unless someone changed
these passwords by hand, `admin@aryv-app.com` / `admin123` has been a working
super-administrator login — full access to user records, ride history, dispute
resolution, commission settings and manual payment release — for anyone who
read this public repository. The admin panel's login form also shipped
pre-filled with exactly these credentials and displayed them on screen.

**Verified against production on 2026-08-26: those accounts do not exist there.**
`admin_users` is absent from the production database entirely. Migrations 001
to 012 were recorded as applied by `db:migrate baseline` without ever being
run, so migration 003 never created the table and never seeded anything. The
credential is published, but nothing in this production database answers to it.

That is worth stating plainly because the opposite was assumed at first. It
does *not* make the published password harmless:

- any environment whose schema was built by actually running the migrations —
  a staging database, a developer's local copy, anyone who cloned the repo —
  does have those accounts;
- and a brand-new environment would run 003 and seed them again. Migration 026
  now runs immediately afterwards and disables them, so new environments come
  up safe.

Two consequences of the same baseline gap matter more than the credential:

- **The admin panel cannot work in production at all.** No `admin_users` table
  means every admin sign-in fails.
- **The cash wallet does not exist in production.** `cash_wallets` and
  `cash_wallet_transactions` are both absent, so wallet top-ups and wallet
  payments cannot work either. Migration 004 was baselined the same way.

Both need migrations 003 and 004 actually applied before those features work.
That is a schema decision, not a security fix, so it is left for you.

### What to do, in order

1. **Apply the migration.** *Done in production on 2026-08-26 — it no-opped,
   because there is no `admin_users` table there.* It still matters for every
   other environment: it deactivates any admin account holding that hash and
   replaces its password with an unusable value. An administrator who already
   set their own password has a different hash and is unaffected. Both 025 and
   026 skip cleanly where their tables are absent.

   ```bash
   npm run db:migrate --workspace backend
   ```

2. **Create a real administrator**, which is now a deliberate act rather than
   something the schema does for you:

   ```bash
   ADMIN_EMAIL=you@aryv-app.com ADMIN_ROLE=super_admin \
     npm run admin:create --workspace backend
   ```

   The password is generated and printed once. Store it in a password manager.
   Re-running for an existing address resets and reactivates that account,
   which is the recovery path if nobody can sign in.

3. **Look for use you did not authorise.** `admin_users.last_login` and the
   `admin_audit_logs` table are the record. Any sign-in to
   `admin@aryv-app.com` that was not one of your team is an intrusion, and
   anything in the audit log around it should be reviewed — particularly
   dispute resolutions, escrow releases and commission changes.

4. **Rotate `ADMIN_JWT_SECRET`.** Admin tokens are now signed with it rather
   than `JWT_SECRET`, so rotating it invalidates every existing admin session —
   including any an intruder holds — without signing out a single passenger.

---

## Deploy ordering

Two things must happen in this order, or production breaks.

**Migrations run before the new code starts.** Railway has no migration step —
`startCommand` is just `node backend/dist/index.js` — and the new build refuses
to boot if migration 025's index is absent, by design. Deploying first means
`process.exit(1)` and a restart loop. Run `npm run db:migrate` against
production first; 025 and 026 are both safe against the currently running
build, so there is no window where the two disagree.

**R2 is configured before uploads matter.** Set `R2_ENDPOINT`,
`R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` on Railway,
using keys rotated per the table above rather than the ones this repository
published. Without them, uploads go to a disk the next deploy erases —
including driver verification documents, whose database rows keep reading
"approved" after the file is gone. After deploying, the startup log should say
`File storage: Cloudflare R2`; if it says `File storage is EPHEMERAL`, the
variables did not take.

The app and the backend no longer have to ship together: `/api/payments/intents`
accepts the older request shape from builds already on people's phones, without
letting them influence any amount. That compatibility path should be removed
once the build sending `bookingId` is the oldest one in the wild.
