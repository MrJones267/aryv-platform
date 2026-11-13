/**
 * @fileoverview The website's launch sign-up list, through the real app:
 *               signing up, leaving, and the admin count and export
 * @author Oabona-Majoko
 * @created 2026-11-12
 * @lastModified 2026-11-13
 *
 * The form is a plain HTML post from aryv-app.com, so every answer must be
 * a redirect back to the site, and the CORS check must not stand in its way.
 */

import request from 'supertest';
import app from '../../index';
import { REDIRECTS } from '../../routes/launchSignups';
import {
  launchSignupService,
  removalToken,
  removalUrl,
  isValidRemovalToken,
} from '../../services/LaunchSignupService';
import LaunchSignup from '../../models/LaunchSignup';
import * as AuditService from '../../services/AuditService';
import { AdminUser } from '../../models/AdminUser';
import { adminAuthHeader } from './harness';

describe('POST /api/launch-signups', () => {
  let saved: jest.SpyInstance;

  beforeEach(() => {
    saved = jest.spyOn(launchSignupService, 'add').mockResolvedValue(undefined);
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
    expect(saved).toHaveBeenCalledWith('neo.kgosi@example.com', null);
  });

  it.each([
    ['android', 'android'],
    ['ios', 'ios'],
    ['', null],
    ['windows-phone', null],
  ])('records the phone %p as %p', async (platform, recorded) => {
    const res = await post({ email: 'mpho@example.com', platform });

    expect(res.headers['location']).toBe(REDIRECTS.saved);
    expect(saved).toHaveBeenCalledWith('mpho@example.com', recorded);
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

describe('removal links', () => {
  const email = 'neo@example.com';
  let removed: jest.SpyInstance;

  beforeEach(() => {
    removed = jest.spyOn(launchSignupService, 'remove').mockResolvedValue(undefined);
  });

  it('signs a link for one address only', () => {
    const token = removalToken(email);

    expect(isValidRemovalToken(email, token)).toBe(true);
    expect(isValidRemovalToken('NEO@example.com', token)).toBe(true);
    expect(isValidRemovalToken('someone-else@example.com', token)).toBe(false);
    expect(isValidRemovalToken(email, `${token}x`)).toBe(false);
    expect(isValidRemovalToken(email, '')).toBe(false);
    expect(isValidRemovalToken(undefined, token)).toBe(false);
    expect(removalUrl(email)).toBe(
      `https://api.aryv-app.com/api/launch-signups/remove?email=neo%40example.com&token=${token}`,
    );
  });

  it('opening the link asks to confirm and removes nothing', async () => {
    const res = await request(app).get(removalUrl(email).replace('https://api.aryv-app.com', ''));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('Remove my email');
    expect(res.text).toContain('neo@example.com');
    expect(removed).not.toHaveBeenCalled();
  });

  it('escapes the address on the page', async () => {
    const odd = '"><b>x@example.com';
    const res = await request(app)
      .get('/api/launch-signups/remove')
      .query({ email: odd, token: removalToken(odd) });

    expect(res.text).not.toContain('"><b>');
    expect(res.text).toContain('&quot;&gt;&lt;b&gt;');
  });

  it('removes the address when the button is pressed', async () => {
    const res = await request(app)
      .post('/api/launch-signups/remove')
      .type('form')
      .send({ email, token: removalToken(email) });

    expect(res.status).toBe(200);
    expect(res.text).toContain('off the list');
    expect(removed).toHaveBeenCalledWith(email);
  });

  it('accepts one-click unsubscribe from a mail client (RFC 8058)', async () => {
    const res = await request(app)
      .post(`/api/launch-signups/remove?email=${encodeURIComponent(email)}&token=${removalToken(email)}`)
      .type('form')
      .send({ 'List-Unsubscribe': 'One-Click' });

    expect(res.status).toBe(200);
    expect(removed).toHaveBeenCalledWith(email);
  });

  it.each([
    ['GET', 'a wrong token'],
    ['POST', 'a wrong token'],
  ])('refuses %s with %s and removes nothing', async (method) => {
    const call = method === 'GET'
      ? request(app).get('/api/launch-signups/remove').query({ email, token: removalToken('other@example.com') })
      : request(app).post('/api/launch-signups/remove').type('form').send({ email, token: 'forged' });
    const res = await call;

    expect(res.status).toBe(400);
    expect(res.text).toContain('isn');
    expect(removed).not.toHaveBeenCalled();
  });
});

describe('admin: launch sign-ups', () => {
  // Admin sign-in looks the admin up; there is no database here, so answer
  // that lookup with an active admin of the role under test.
  const as = (role: string) => {
    const id = '44444444-4444-4444-8444-444444444444';
    jest.spyOn(AdminUser, 'findByPk').mockResolvedValue({
      isActive: true,
      sessionsRevokedAt: null,
      toSafeObject: () => ({ id, email: 'staff@example.com', role }),
    } as any);
    return adminAuthHeader({ id, role });
  };

  it('counts sign-ups for any admin', async () => {
    jest.spyOn(launchSignupService, 'summary').mockResolvedValue({
      total: 3, android: 1, ios: 1, unspecified: 1, latestAt: '2026-11-13T08:00:00.000Z',
    });

    const res = await request(app).get('/api/admin/launch-signups').set(as('moderator'));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 3, android: 1, ios: 1 });
  });

  it('refuses the count without an admin token', async () => {
    const res = await request(app).get('/api/admin/launch-signups');
    expect(res.status).toBe(401);
  });

  it('exports CSV with removal links for admins, and logs the export', async () => {
    jest.spyOn(LaunchSignup, 'findAll').mockResolvedValue([
      { email: 'neo@example.com', platform: 'ios', createdAt: new Date('2026-11-12T15:19:59Z') },
      { email: '=cmd@example.com', platform: null, createdAt: new Date('2026-11-13T08:00:00Z') },
    ] as any);
    const audit = jest.spyOn(AuditService, 'recordAdminAction').mockResolvedValue(undefined);

    const res = await request(app).get('/api/admin/launch-signups/export').set(as('admin'));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="aryv-launch-signups-\d{4}-\d{2}-\d{2}\.csv"/);
    const lines = res.text.trim().split('\r\n');
    expect(lines[0]).toBe('email,platform,signed_up_at,removal_link');
    expect(lines[1]).toBe(`"neo@example.com","ios","2026-11-12T15:19:59.000Z","${removalUrl('neo@example.com')}"`);
    // A spreadsheet must not run an address as a formula.
    expect(lines[2].startsWith('"\'=cmd@example.com"')).toBe(true);
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'launch_signups.export', details: expect.objectContaining({ count: 2 }) }));
  });

  it('keeps the export from moderators', async () => {
    const res = await request(app).get('/api/admin/launch-signups/export').set(as('moderator'));
    expect(res.status).toBe(403);
  });
});
