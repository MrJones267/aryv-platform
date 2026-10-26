/**
 * @fileoverview Regression tests for the validateInput middleware.
 * @author Oabona-Majoko
 * @created 2026-08-22
 * @lastModified 2026-08-22
 *
 * validateInput was an alias for validateRequest, a Joi-schema *factory*.
 * Used bare in a route — which is how all ~130 call sites use it — Express
 * called it as (req, res, next), so it treated the request as a schema,
 * returned a middleware nobody invoked, and never called next(). Every route
 * carrying it hung until the client gave up.
 */

import express, { Request, Response } from 'express';
import request from 'supertest';
import { body, query } from 'express-validator';
import { validateInput, validateRequest } from '../../middleware/validation';
import Joi from 'joi';

const buildApp = () => {
  const app = express();
  app.use(express.json());

  app.post('/body', [body('count').optional().isInt(), validateInput], (_req: Request, res: Response) => {
    res.json({ reached: true });
  });

  app.get('/search', [query('q').notEmpty().isLength({ max: 50 }), validateInput], (req: Request, res: Response) => {
    res.json({ q: req.query['q'] });
  });

  // The factory form is still used by routes/auth.ts and must keep working.
  app.post(
    '/joi',
    validateRequest({ body: Joi.object({ email: Joi.string().email().required() }) }),
    (_req: Request, res: Response) => res.json({ reached: true }),
  );

  return app;
};

describe('validateInput', () => {
  const app = buildApp();

  it('calls next() so the handler is reached', async () => {
    const res = await request(app).post('/body').send({ count: 5 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reached: true });
  });

  it('does not hang when no validation errors are present', async () => {
    // The original defect surfaced as a timeout rather than a wrong status, so
    // this asserts a response arrives at all.
    const res = await request(app).get('/search').query({ q: 'botswana' }).timeout(3000);

    expect(res.status).toBe(200);
    expect(res.body.q).toBe('botswana');
  });

  it('returns 400 with field details when a chain fails', async () => {
    const res = await request(app).post('/body').send({ count: 'not-a-number' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.details[0].field).toBe('count');
  });

  it('rejects a missing required query parameter', async () => {
    const res = await request(app).get('/search');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('is a three-argument middleware, not a factory', () => {
    // Guards against the alias being reintroduced: a factory has arity 1.
    expect(validateInput.length).toBe(3);
  });
});

describe('validateRequest', () => {
  const app = buildApp();

  it('still works as a Joi schema factory', async () => {
    const ok = await request(app).post('/joi').send({ email: 'rider@example.com' });
    expect(ok.status).toBe(200);

    const bad = await request(app).post('/joi').send({ email: 'not-an-email' });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('VALIDATION_ERROR');
  });
});
