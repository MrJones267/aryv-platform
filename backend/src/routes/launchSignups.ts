/**
 * @fileoverview "Tell me when ARYV launches": the email form on aryv-app.com
 * @author Oabona-Majoko
 * @created 2026-11-12
 * @lastModified 2026-11-12
 *
 * The website runs no scripts, so this takes a plain HTML form post and
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
 */

import express, { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { makeStore } from '../config/rateLimitStore';
import { rateLimitKey } from '../config/rateLimitKey';
import LaunchSignup from '../models/LaunchSignup';
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
      const email = (req.body.email as string).toLowerCase();
      // ON CONFLICT DO NOTHING: two posts of one address at once both succeed.
      await LaunchSignup.bulkCreate([{ email }], { ignoreDuplicates: true });
      back(res, REDIRECTS.saved);
    } catch (error) {
      logError('Could not save a launch sign-up', error as Error);
      back(res, REDIRECTS.failed);
    }
  },
);

export default router;
