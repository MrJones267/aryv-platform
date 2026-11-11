# ARYV public website

Static pages for `https://aryv-app.com`: landing, Privacy Policy, Terms of
Service, and the account-deletion page Google Play requires. No build step.

## Design

Plain HTML and CSS, no scripts (the CSP in `_headers` forbids them, and
inline styles too). Colours come from the ARYV mark (`assets/mark.svg`, a
vector trace of `ARYV3.png`). The font is Plus Jakarta Sans
(`assets/jakarta-latin.woff2`, SIL Open Font License 1.1), self-hosted
because the CSP allows fonts from this site only. The phone and app cards
on the landing page are illustrations built in HTML/CSS, not screenshots.
Light and dark mode follow the visitor's system setting.

## Search and sharing

- `assets/og-image.jpg` (1200x630) is the preview shown when a link is
  shared. Keep it under 300 KB or WhatsApp will not show it. It was
  rendered from HTML using the site's font and mark.
- `sitemap.xml` lists the indexable pages; update `lastmod` when a page
  changes. `robots.txt` points to it. The 404 page is `noindex`.
- The landing page carries Organization and WebSite structured data
  (JSON-LD). That is a data block, not a script, so the CSP does not
  block it.
- "Notify me at launch" is a `mailto:` link to hello@aryv-app.com with
  a pre-filled subject, so the site still needs no forms or scripts.

## Deploy (Cloudflare Pages)

1. Create a Pages project connected to this repository.
2. Build command: none. Build output directory: `website`.
3. Add the custom domains `aryv-app.com` and `www.aryv-app.com`.

Pages serves `privacy.html` at `/privacy`, and so on, which are the addresses
the app links to.

## Before publishing

The legal pages were written from what the code does and need legal review.
Open points: hosting regions, and how long financial records are kept.
