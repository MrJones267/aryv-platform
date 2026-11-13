# ARYV public website

Static pages for `https://aryv-app.com`: landing, Drive with ARYV
(`drive.html`), Privacy Policy, Terms of Service, and the account-deletion
page Google Play requires. No build step.

## Design

Plain HTML and CSS, no scripts (the CSP in `_headers` forbids them, and
inline styles too). Colours come from the ARYV mark (`assets/mark.svg`, a
vector trace of `ARYV3.png`). The font is Plus Jakarta Sans
(`assets/jakarta-latin.woff2`, SIL Open Font License 1.1), self-hosted
because the CSP allows fonts from this site only. The phone and app cards
on the landing page are illustrations built in HTML/CSS, not screenshots.
Light and dark mode follow the visitor's system setting.

## Content rules

- Every claim about how ARYV works is taken from the Terms, the Privacy
  Policy or the app's code. Nothing is invented: no user counts, no
  earnings figures.
- Fees and commission are described, never given as percentages, because
  admins can change the rates in settings. If you publish numbers, the site
  must change whenever the rates do.
- Driver documents on `drive.html` follow `REQUIRED_DOCUMENT_TYPES` in
  `backend/src/models/DriverDocument.ts` (licence, vehicle registration,
  insurance). Update the page if that list changes.

## Checks

Lighthouse (12.2, mobile and desktop) on every page, 13 November 2026:
performance 98-100, accessibility 100, best practices 100. SEO is 92 only
because Lighthouse fetches `robots.txt` from inside the page and the CSP
blocks that; crawlers fetch it directly. Rerun after design changes.

## Search and sharing

- `assets/og-image.jpg` (1200x630) is the preview shown when a link is
  shared. Keep it under 300 KB or WhatsApp will not show it. It was
  rendered from HTML using the site's font and mark.
- `sitemap.xml` lists the indexable pages; update `lastmod` when a page
  changes. `robots.txt` points to it. The 404 page is `noindex`.
- The landing page carries Organization and WebSite structured data
  (JSON-LD). That is a data block, not a script, so the CSP does not
  block it.
- "Notify me" is a plain HTML form that posts to
  `https://api.aryv-app.com/api/launch-signups` (backend
  `routes/launchSignups.ts`, table `launch_signups`, migration 043). The API
  stores the address and redirects to `/thanks`, or back to
  `/#notify-invalid` / `/#notify-failed`, which CSS `:target` shows beside the
  form. No scripts are needed, and the CSP's `form-action` allows only the
  API. The hidden `company` field is a bot trap.
- The form also asks, optionally, Android or iPhone (`platform`, migration
  044). The admin dashboard's "Launch sign-ups" card shows the counts.
- **At launch:** download the CSV from that card (admin role and above;
  each download is in the audit log). Every row has a `removal_link`; put it
  in that person's email, and also send the header
  `List-Unsubscribe: <removal_link>` with
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click` so mail apps show an
  unsubscribe button. The link opens a confirm page on the API; nothing is
  removed until the person presses the button. Links are signed with
  `LAUNCH_SIGNUP_SECRET` (or `JWT_SECRET` when unset), so changing that
  secret breaks links already sent.
- The Privacy Policy says the list is deleted once the launch email is
  sent: `DELETE FROM launch_signups;` afterwards.
- "Share ARYV on WhatsApp" (final section and /thanks) is a plain
  `https://wa.me/?text=` link and needs no business number.
- `styles.css` is linked as `styles.css?v=N` on every page, because
  Cloudflare lets browsers keep it for 4 hours. Bump `N` on every page
  whenever the stylesheet changes.

## Deploy (Cloudflare Pages)

1. Create a Pages project connected to this repository.
2. Build command: none. Build output directory: `website`.
3. Add the custom domains `aryv-app.com` and `www.aryv-app.com`.

Pages serves `privacy.html` at `/privacy`, and so on, which are the addresses
the app links to.

## Before publishing

The legal pages were written from what the code does and need legal review.
Open points: hosting regions, and how long financial records are kept.
