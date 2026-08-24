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
