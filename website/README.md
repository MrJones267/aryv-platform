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

## Deploy (Cloudflare Pages)

1. Create a Pages project connected to this repository.
2. Build command: none. Build output directory: `website`.
3. Add the custom domains `aryv-app.com` and `www.aryv-app.com`.

Pages serves `privacy.html` at `/privacy`, and so on, which are the addresses
the app links to.

## Before publishing

The legal pages were written from what the code does and need legal review.
Open points: hosting regions, and how long financial records are kept.
