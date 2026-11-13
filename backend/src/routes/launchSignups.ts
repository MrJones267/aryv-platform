/**
 * @fileoverview "Tell me when ARYV launches": the email form on aryv-app.com,
 *               and the link that takes an address off the list again
 * @author Oabona-Majoko
 * @created 2026-11-12
 * @lastModified 2026-11-13
 *
 * The website runs no scripts, so sign-up takes a plain HTML form post and
 * answers with a redirect back to the site: /thanks when the address is
 * kept, or a marker on the home page that shows a message beside the form.
 *
 * It is mounted before the CORS middleware. A form post is not a CORS
 * request (the browser sends it and follows the redirect without reading
 * the response), and the CORS check would otherwise reject the website's
 * Origin unless someone remembered to add it to CORS_ORIGIN.
 *
 * The answer is the same whether or not the address was already on the
 * list, so the form cannot be used to find out who has signed up.
 *
 * Removal: every launch email carries a signed link to GET /remove, which
 * shows a confirm button. Opening the link removes nothing, because mail
 * scanners open links on their own. The button posts back, and so does a
 * mail client's one-click unsubscribe (RFC 8058). The pages are served from
 * here rather than the website: the API's CSP allows a form to post only to
 * the API, and a browser applies that to redirects as well.
 */

import express, { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { makeStore } from '../config/rateLimitStore';
import { rateLimitKey } from '../config/rateLimitKey';
import { launchSignupService, asLaunchPlatform, isValidRemovalToken } from '../services/LaunchSignupService';
import { logError } from '../utils/logger';

/** Where the visitor is sent back to. Fixed, so this is not an open redirect. */
const WEBSITE_URL = (process.env['WEBSITE_URL'] || 'https://aryv-app.com').replace(/\/+$/, '');

export const REDIRECTS = {
  saved: `${WEBSITE_URL}/thanks`,
  invalid: `${WEBSITE_URL}/#notify-invalid`,
  failed: `${WEBSITE_URL}/#notify-failed`,
};

const router = Router();

const back = (res: Response, to: string): void => {
  res.redirect(303, to);
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[c] as string);

/** A small standalone page in ARYV's colours. */
const page = (res: Response, status: number, title: string, bodyHtml: string): void => {
  res
    .status(status)
    .set('Cache-Control', 'no-store')
    .set('X-Robots-Tag', 'noindex')
    .type('html')
    .send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${escapeHtml(title)} | ARYV</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1020;color:#f4f6fb;font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;padding:24px;box-sizing:border-box}
main{max-width:30rem;background:#131a30;border:1px solid #232c47;border-radius:20px;padding:32px}
h1{margin:0 0 12px;font-size:1.6rem;line-height:1.2}
p{margin:0 0 16px;color:#a9b2c8}strong{color:#f4f6fb;word-break:break-all}
a{color:#5ee9d1}
button{font:700 1rem/1 inherit;border:0;border-radius:999px;padding:16px 26px;cursor:pointer;color:#0b1020;background:linear-gradient(105deg,#33ecc4,#5e98e2 52%,#a046ee)}
</style></head><body><main>${bodyHtml}</main></body></html>`);
};

const invalidLink = (res: Response): void =>
  page(res, 400, 'Link not valid', `<h1>This link isn't valid</h1>
<p>It may have been copied only in part. To be taken off the list, email
<a href="mailto:hello@aryv-app.com">hello@aryv-app.com</a> and we will remove you.</p>
<p><a href="${WEBSITE_URL}/">Go to aryv-app.com</a></p>`);

router.use(express.urlencoded({ extended: false, limit: '2kb' }));

router.post(
  '/',
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    store: makeStore('launch-signups'),
    keyGenerator: rateLimitKey,
    handler: (_req, res) => back(res, REDIRECTS.failed),
  }),
  body('email').isString().trim().isLength({ max: 254 }).isEmail(),
  async (req: Request, res: Response): Promise<void> => {
    // A field people cannot see. Bots that fill in every field are told
    // their address was kept, and nothing is stored.
    if (typeof req.body?.company === 'string' && req.body.company.trim() !== '') {
      back(res, REDIRECTS.saved);
      return;
    }

    if (!validationResult(req).isEmpty()) {
      back(res, REDIRECTS.invalid);
      return;
    }

    try {
      // An unknown platform is dropped rather than refused: the question is
      // optional, and the address is what matters.
      await launchSignupService.add((req.body.email as string).toLowerCase(), asLaunchPlatform(req.body.platform));
      back(res, REDIRECTS.saved);
    } catch (error) {
      logError('Could not save a launch sign-up', error as Error);
      back(res, REDIRECTS.failed);
    }
  },
);

const removalLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  store: makeStore('launch-signup-removals'),
  keyGenerator: rateLimitKey,
  handler: (_req, res) => page(res, 429, 'Try again later', '<h1>Please try again later</h1><p>Too many tries from this connection.</p>'),
});

/** The link in a launch email. Shows the confirm button; removes nothing. */
router.get('/remove', removalLimit, (req: Request, res: Response): void => {
  const { email, token } = req.query;
  if (!isValidRemovalToken(email, token)) {
    invalidLink(res);
    return;
  }
  page(res, 200, 'Leave the launch list', `<h1>Leave the launch list?</h1>
<p>We will stop emailing <strong>${escapeHtml(email)}</strong> about ARYV's launch and delete the address.</p>
<form method="post" action="/api/launch-signups/remove">
<input type="hidden" name="email" value="${escapeHtml(email)}">
<input type="hidden" name="token" value="${escapeHtml(token as string)}">
<button type="submit">Remove my email</button>
</form>`);
});

/**
 * The confirm button, and one-click unsubscribe from a mail client, which
 * posts `List-Unsubscribe=One-Click` to the link with its query string.
 */
router.post('/remove', removalLimit, async (req: Request, res: Response): Promise<void> => {
  const email = req.body?.email ?? req.query['email'];
  const token = req.body?.token ?? req.query['token'];
  const oneClick = req.body?.['List-Unsubscribe'] === 'One-Click';

  if (!isValidRemovalToken(email, token)) {
    if (oneClick) res.status(400).type('text').send('Link not valid');
    else invalidLink(res);
    return;
  }

  try {
    await launchSignupService.remove(email);
  } catch (error) {
    logError('Could not remove a launch sign-up', error as Error);
    if (oneClick) res.status(500).type('text').send('Could not remove the address; please try again');
    else page(res, 500, 'Please try again', `<h1>Sorry, that didn't work</h1>
<p>Please try the link again in a few minutes, or email <a href="mailto:hello@aryv-app.com">hello@aryv-app.com</a>.</p>`);
    return;
  }

  if (oneClick) {
    res.status(200).type('text').send('Removed');
    return;
  }
  page(res, 200, 'Removed', `<h1>You're off the list.</h1>
<p>We have deleted <strong>${escapeHtml(email)}</strong> and won't email it about the launch.</p>
<p><a href="${WEBSITE_URL}/">Back to aryv-app.com</a></p>`);
});

export default router;
