/**
 * @fileoverview The website's launch sign-up form, through the real app
 * @author Oabona-Majoko
 * @created 2026-11-12
 * @lastModified 2026-11-12
 *
 * The form is a plain HTML post from aryv-app.com, so every answer must be
 * a redirect back to the site, and the CORS check must not stand in its way.
 */

import request from 'supertest';
import app from '../../index';
import LaunchSignup from '../../models/LaunchSignup';
import { REDIRECTS } from '../../routes/launchSignups';

describe('POST /api/launch-signups', () => {
  let saved: jest.SpyInstance;

  beforeEach(() => {
    saved = jest.spyOn(LaunchSignup, 'bulkCreate').mockResolvedValue([] as any);
  });

  const post = (form: Record<string, string>) =>
    request(app)
      .post('/api/launch-signups')
      .set('Origin', 'https://aryv-app.com')
      .type('form')
      .send(form);

  it('keeps the address, lower-cased and trimmed, and sends the visitor to /thanks', async () => {
    const res = await post({ email: '  Neo.Kgosi@Example.COM ' });

    expect(res.status).toBe(303);
    expect(res.headers['location']).toBe(REDIRECTS.saved);
    expect(saved).toHaveBeenCalledWith([{ email: 'neo.kgosi@example.com' }], { ignoreDuplicates: true });
  });

  it('answers a repeat sign-up exactly as it answers a new one', async () => {
    const first = await post({ email: 'tumi@example.com' });
    const again = await post({ email: 'tumi@example.com' });

    expect(again.status).toBe(first.status);
    expect(again.headers['location']).toBe(first.headers['location']);
  });

  it.each([
    ['no address', {}],
    ['an empty address', { email: '' }],
    ['something that is not an address', { email: 'not-an-email' }],
    ['an address longer than 254 characters', { email: `${'a'.repeat(250)}@example.com` }],
  ])('sends %s back to the form with a message, storing nothing', async (_label, form) => {
    const res = await post(form as Record<string, string>);

    expect(res.status).toBe(303);
    expect(res.headers['location']).toBe(REDIRECTS.invalid);
    expect(saved).not.toHaveBeenCalled();
  });

  it('tells a bot that fills the hidden field it worked, and stores nothing', async () => {
    const res = await post({ email: 'bot@example.com', company: 'Spam Ltd' });

    expect(res.status).toBe(303);
    expect(res.headers['location']).toBe(REDIRECTS.saved);
    expect(saved).not.toHaveBeenCalled();
  });

  it('says it could not save when the database fails', async () => {
    saved.mockRejectedValueOnce(new Error('connection refused'));

    const res = await post({ email: 'kago@example.com' });

    expect(res.status).toBe(303);
    expect(res.headers['location']).toBe(REDIRECTS.failed);
  });

  it('is not blocked by CORS for an origin outside CORS_ORIGIN', async () => {
    const res = await request(app)
      .post('/api/launch-signups')
      .set('Origin', 'https://not-on-the-list.example')
      .type('form')
      .send({ email: 'lesedi@example.com' });

    expect(res.status).toBe(303);
  });

  it('sends visitors only to the website, whatever they post', async () => {
    const res = await post({ email: 'x@example.com', next: 'https://evil.example' });

    expect(res.headers['location'].startsWith('https://aryv-app.com/')).toBe(true);
  });
});
