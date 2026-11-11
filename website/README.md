# ARYV public website

Static pages for `https://aryv-app.com`: landing, Privacy Policy, Terms of
Service, and the account-deletion page Google Play requires. No build step.

## Deploy (Cloudflare Pages)

1. Create a Pages project connected to this repository.
2. Build command: none. Build output directory: `website`.
3. Add the custom domains `aryv-app.com` and `www.aryv-app.com`.

Pages serves `privacy.html` at `/privacy`, and so on, which are the addresses
the app links to.

## Before publishing

The legal pages were written from what the code does and need legal review.
Open points: hosting regions, and how long financial records are kept.
