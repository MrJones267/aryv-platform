/**
 * @fileoverview Integration tests for reviewing driver documents from the admin panel
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * Drivers could upload documents, and the admin panel counted them, but no
 * one could review them from the panel: the review routes took a rider's
 * token, and reviewed_by could not hold an admin panel id. These cover the
 * queue, viewing the file, every decision, and the outcome that matters: a
 * driver whose required documents are all approved becomes verified.
 */

import fs from 'fs';
import path from 'path';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../index';
import { User } from '../../models';
import { AdminUser } from '../../models/AdminUser';
import DriverDocument from '../../models/DriverDocument';
import { UPLOADS_DIR } from '../../middleware/upload';
import { UserRole } from '../../types';

const DOCS_DIR = path.resolve(UPLOADS_DIR, 'documents');
const NEXT_YEAR = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

describe('Admin document review', () => {
  let adminToken: string;
  let moderatorToken: string;
  let driver: any;
  let licence: any;
  let registration: any;

  const tokenFor = (admin: AdminUser) =>
    jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, permissions: admin.permissions, type: 'admin' },
      process.env['ADMIN_JWT_SECRET']!,
      { expiresIn: '1h' }
    );

  const doc = (documentType: string, extra: Record<string, unknown> = {}) =>
    DriverDocument.create({
      userId: driver.id,
      documentType,
      storageKey: `${driver.id}-${documentType}.jpg`,
      originalFilename: `${documentType}.jpg`,
      mimeType: 'image/jpeg',
      fileSizeBytes: 9,
      ...extra,
    } as any);

  beforeAll(() => {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  });

  beforeEach(async () => {
    // The setup file empties every table before each test.
    const admin = await AdminUser.createAdmin({
      email: 'reviewer@test.com', password: 'Integration-Test-Password-1!',
      firstName: 'Rev', lastName: 'Iewer', role: 'admin', permissions: ['users.read'],
    });
    adminToken = tokenFor(admin);
    moderatorToken = tokenFor(await AdminUser.createAdmin({
      email: 'mod@test.com', password: 'Integration-Test-Password-1!',
      firstName: 'Mod', lastName: 'Erator', role: 'moderator', permissions: ['users.read'],
    }));

    driver = await User.create({
      email: 'driver@test.com', password: 'Integration-Test-Password-1!',
      firstName: 'Tumelo', lastName: 'Driver', role: UserRole.DRIVER,
    });
    licence = await doc('drivers_license', { documentExpiresAt: NEXT_YEAR });
    registration = await doc('vehicle_registration');
    fs.writeFileSync(path.join(DOCS_DIR, licence.storageKey), 'jpeg-data');
  });

  afterEach(() => {
    for (const d of [licence, registration]) {
      try { fs.unlinkSync(path.join(DOCS_DIR, d.storageKey)); } catch { /* not written */ }
    }
  });

  const as = (token: string) => ({
    get: (p: string) => request(app).get(p).set('Authorization', `Bearer ${token}`),
    review: (id: string, body: object) =>
      request(app).post(`/api/admin/verifications/documents/${id}/review`).set('Authorization', `Bearer ${token}`).send(body),
  });

  it('lists waiting documents grouped by driver', async () => {
    const response = await as(adminToken).get('/api/admin/verifications').expect(200);
    const [entry] = response.body.data.drivers;

    expect(response.body.data.drivers).toHaveLength(1);
    expect(entry).toMatchObject({ userId: driver.id, userName: 'Tumelo Driver', email: 'driver@test.com' });
    expect(entry.documents.map((d: any) => d.documentType).sort()).toEqual(['drivers_license', 'vehicle_registration']);
  });

  it('serves the file to an admin, and not to a moderator', async () => {
    const response = await as(adminToken).get(`/api/admin/verifications/documents/${licence.id}/file`).expect(200);
    expect(response.body.toString()).toBe('jpeg-data');

    await as(moderatorToken).get(`/api/admin/verifications/documents/${licence.id}/file`).expect(403);
  });

  it('says when the file is no longer on the server', async () => {
    const response = await as(adminToken).get(`/api/admin/verifications/documents/${registration.id}/file`).expect(404);
    expect(response.body.code).toBe('FILE_NOT_FOUND');
  });

  it('records an approval against the admin who made it', async () => {
    const response = await as(adminToken).review(licence.id, { approve: true }).expect(200);
    expect(response.body.data.status).toBe('approved');

    const reloaded = await DriverDocument.findByPk(licence.id);
    expect(reloaded!.reviewedBy).toBeTruthy();
    expect(reloaded!.reviewedAt).toBeTruthy();

    const queue = await as(adminToken).get('/api/admin/verifications').expect(200);
    expect(queue.body.data.drivers[0].documents.map((d: any) => d.id)).toEqual([registration.id]);
  });

  it('verifies the driver once every required document is approved', async () => {
    // Licence, registration and insurance are all required.
    const insurance = await doc('insurance_card', { documentExpiresAt: NEXT_YEAR });

    const first = await as(adminToken).review(licence.id, { approve: true }).expect(200);
    expect(first.body.data.driverStatus).not.toBe('verified');
    await as(adminToken).review(registration.id, { approve: true }).expect(200);
    const response = await as(adminToken).review(insurance.id, { approve: true }).expect(200);

    expect(response.body.data.driverStatus).toBe('verified');
    expect((await User.findByPk(driver.id))!.driverVerificationStatus).toBe('verified');
  });

  it('requires a reason to reject, and can ask for a resubmission instead', async () => {
    await as(adminToken).review(licence.id, { approve: false }).expect(400);

    const resubmit = await as(adminToken)
      .review(licence.id, { approve: false, rejectionReason: 'Photo is blurred', allowResubmission: true })
      .expect(200);
    expect(resubmit.body.data.status).toBe('requires_resubmission');

    const rejected = await as(adminToken).review(registration.id, { approve: false, rejectionReason: 'Not a registration document' }).expect(200);
    expect(rejected.body.data.status).toBe('rejected');
    expect((await DriverDocument.findByPk(registration.id))!.rejectionReason).toBe('Not a registration document');
  });

  it('refuses to review a document twice', async () => {
    await as(adminToken).review(licence.id, { approve: true }).expect(200);
    await as(adminToken).review(licence.id, { approve: false, rejectionReason: 'Changed my mind' }).expect(409);
  });

  it('does not let a moderator decide', async () => {
    await as(moderatorToken).review(licence.id, { approve: true }).expect(403);
  });

  it('validates the decision', async () => {
    await as(adminToken).review(licence.id, { approve: 'yes' }).expect(400);
    await as(adminToken).review(licence.id, { approve: false, rejectionReason: 'no' }).expect(400);
    await as(adminToken).review('00000000-0000-4000-8000-000000000000', { approve: true }).expect(404);
  });
});
