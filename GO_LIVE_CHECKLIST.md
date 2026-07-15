# ARYV — Go-Live & App Store Launch Checklist

**Goal:** Ship ARYV to production and publish on the Apple App Store and Google Play Store.
**Owner:** Oabona-Majoko
**Last updated:** 2026-06-17

Legend: `[ ]` = to do · `[~]` = in progress · `[x]` = done · 🔴 = blocker · 🟡 = important · 🟢 = nice-to-have

---

## 0. Pre-Launch Foundations (do first)

- [ ] 🔴 Lock down a production-ready `main` branch (merge `ci/modernize-pipeline`)
- [ ] 🔴 Confirm CI is green (unit gate, build, lint, type-check)
- [ ] 🔴 All secrets moved to env/secret manager — none committed to git
- [ ] 🔴 `npm audit` shows zero critical/high vulnerabilities
- [ ] 🟡 Tag a release candidate (e.g. `v1.0.0-rc.1`)
- [ ] 🟡 Remove investor/financial docs from the app repo or move to a private repo
      (`ARYV_INVESTMENT_PROPOSAL.*`, `ARYV_Financial_Projections.xlsx`, `ARYV_ONE_PAGER.*`)

---

## 1. Backend Production Readiness

- [ ] 🔴 Provision production database (PostgreSQL + PostGIS) with backups enabled
- [ ] 🔴 Run and verify all DB migrations against production
- [ ] 🔴 Provision production Redis (sessions / real-time)
- [ ] 🔴 Set all production env vars (DB, Redis, JWT secret, payment keys, maps API)
- [ ] 🔴 Enable HTTPS/TLS on the API domain
- [ ] 🟡 Configure CORS for production mobile/web origins only
- [ ] 🟡 Rate limiting + helmet enabled on all public endpoints
- [ ] 🟡 Health check endpoint (`/health`) wired to uptime monitoring
- [ ] 🟡 Structured logging + error tracking (e.g. Sentry) in production
- [ ] 🟡 Load/performance test critical endpoints (target < 200ms)
- [ ] 🟢 Automated daily DB backup + tested restore procedure
- [ ] 🟢 Staging environment mirrors production for final QA

---

## 2. Payments & Compliance

- [ ] 🔴 Switch payment provider (Stripe/etc.) from test to **live** keys
- [ ] 🔴 Verify real end-to-end transaction in production
- [ ] 🔴 Configure payout/settlement accounts for drivers
- [ ] 🟡 Refund + dispute flow tested
- [ ] 🟡 PCI compliance: confirm no raw card data touches your servers
- [ ] 🟡 Webhook signatures verified (no unauthenticated webhook handlers)

---

## 3. Legal & Policy (required for store approval)

- [ ] 🔴 Privacy Policy published at a public URL
- [ ] 🔴 Terms of Service / EULA published at a public URL
- [ ] 🔴 Data deletion / account deletion mechanism (required by both stores)
- [ ] 🟡 Driver agreement + passenger terms
- [ ] 🟡 GDPR/POPIA data-handling review (consent, data export, retention)
- [ ] 🟡 Insurance / liability terms for ride-sharing reviewed with legal
- [ ] 🟢 Cookie/tracking disclosure if using analytics

---

## 4. Mobile App — Build & Configuration

- [ ] 🔴 Set app version + build number (`1.0.0` / build `1`)
- [ ] 🔴 Point app to **production** API URL (no localhost/staging)
- [ ] 🔴 Final app name, bundle ID (iOS) and package name (Android) locked
      (e.g. `com.aryv.app`) — these are permanent once published
- [ ] 🔴 App icon (all required sizes) + adaptive icon (Android)
- [ ] 🔴 Splash screen
- [ ] 🟡 Configure deep links / universal links
- [ ] 🟡 Push notifications (APNs cert / FCM) configured for production
- [ ] 🟡 Crash reporting in release builds
- [ ] 🟡 Remove all debug logging, dev menus, and test accounts
- [ ] 🟡 Request only the permissions actually used (location, camera, notifications)
- [ ] 🟢 Test on a range of real devices (low-end Android + recent iPhone)

---

## 5. Apple App Store (iOS)

- [ ] 🔴 Apple Developer Program membership ($99/yr) active
- [ ] 🔴 App created in App Store Connect
- [ ] 🔴 Signing certs + provisioning profiles (or use EAS/automatic signing)
- [ ] 🔴 Production release build (`.ipa`) uploaded via Xcode/Transporter/EAS
- [ ] 🔴 App Privacy "Nutrition Label" filled out (data collection disclosure)
- [ ] 🟡 Screenshots for required device sizes (6.7", 6.5", 5.5", iPad if supported)
- [ ] 🟡 App description, keywords, subtitle, promotional text
- [ ] 🟡 Support URL + marketing URL
- [ ] 🟡 Age rating questionnaire completed
- [ ] 🟡 Demo account credentials for Apple reviewers (rides need a working login)
- [ ] 🟡 Background location justification (ride tracking — common rejection point)
- [ ] 🔴 Submit for review → respond to any rejections → release

---

## 6. Google Play Store (Android)

- [ ] 🔴 Google Play Developer account ($25 one-time) active
- [ ] 🔴 App created in Play Console
- [ ] 🔴 Signed release **AAB** (Android App Bundle) uploaded
- [ ] 🔴 Play App Signing enrolled
- [ ] 🔴 Data Safety form completed (data collection/sharing disclosure)
- [ ] 🟡 Store listing: title, short + full description, screenshots, feature graphic
- [ ] 🟡 Content rating questionnaire (IARC)
- [ ] 🟡 Target audience + ads declaration
- [ ] 🟡 Background location permission declaration form (Play reviews this strictly)
- [ ] 🟡 Demo account for reviewers
- [ ] 🟡 Closed testing track (min testers) before production — newer Play requirement
- [ ] 🔴 Submit to production track → respond to review → roll out

---

## 7. Final QA & Smoke Test (against production)

- [ ] 🔴 Sign up → log in → log out
- [ ] 🔴 Create a ride / search a ride
- [ ] 🔴 Book a ride end-to-end
- [ ] 🔴 Real-time tracking works
- [ ] 🔴 Real payment processes and shows correctly
- [ ] 🔴 Push notification received on a real device
- [ ] 🟡 Account deletion works
- [ ] 🟡 Error states (no network, payment fail) handled gracefully

---

## 8. Launch Day & Post-Launch

- [ ] 🟡 Monitoring dashboards + alerts live (errors, latency, uptime)
- [ ] 🟡 On-call / incident response plan for first 48h
- [ ] 🟡 Support channel ready (email / in-app)
- [ ] 🟢 Rollback plan documented (revert deploy, app store phased rollout)
- [ ] 🟢 Use phased/staged rollout (Play) and gradual release to limit blast radius
- [ ] 🟢 Announce launch (marketing, social, landing page)
- [ ] 🟢 Plan v1.0.1 fast-follow for early bug fixes

---

### Critical-path summary (the 🔴 must-dos)
1. Backend live on HTTPS with prod DB/Redis + migrations + secrets
2. Live payments verified with a real transaction
3. Privacy Policy, Terms, and account deletion published
4. Production app builds pointing at prod API, correct version/bundle IDs
5. Store accounts + signed builds uploaded with privacy disclosures
6. Demo accounts + background-location justification for reviewers
7. Submit → pass review → release
