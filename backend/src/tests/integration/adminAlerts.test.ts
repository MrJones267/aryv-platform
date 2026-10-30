/**
 * @fileoverview Integration tests for the admin alerts feed and SOS handling
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * The admin panel's bell and Disputes badge showed hardcoded numbers, and an
 * SOS alert reached no one at ARYV. These cover the feed the panel now polls
 * and the actions that let an operator take an SOS alert off it.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../index';
import { User, Package, DeliveryAgreement, DeliveryDispute } from '../../models';
import { AdminUser } from '../../models/AdminUser';
import EmergencyAlert from '../../models/EmergencyAlert';
import DriverDocument from '../../models/DriverDocument';
import { UserRole } from '../../types';

const point = (lng: number, lat: number) => ({ type: 'Point', coordinates: [lng, lat] });

describe('Admin alerts', () => {
  let adminToken: string;
  let moderatorToken: string;
  let raised: any;

  const tokenFor = (admin: AdminUser) =>
    jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, permissions: admin.permissions, type: 'admin' },
      process.env['ADMIN_JWT_SECRET']!,
      { expiresIn: '1h' }
    );

  beforeEach(async () => {
    // The setup file empties every table before each test.
    adminToken = tokenFor(await AdminUser.createAdmin({
      email: 'ops@test.com', password: 'Integration-Test-Password-1!',
      firstName: 'Ops', lastName: 'Admin', role: 'admin', permissions: ['disputes.manage'],
    }));
    moderatorToken = tokenFor(await AdminUser.createAdmin({
      email: 'mod@test.com', password: 'Integration-Test-Password-1!',
      firstName: 'Mod', lastName: 'Erator', role: 'moderator', permissions: ['disputes.manage'],
    }));

    const rider = await User.create({
      email: 'rider@test.com', password: 'Integration-Test-Password-1!',
      firstName: 'Lesedi', lastName: 'Rider', role: UserRole.PASSENGER,
    });
    const driver = await User.create({
      email: 'driver@test.com', password: 'Integration-Test-Password-1!',
      firstName: 'Tumelo', lastName: 'Driver', role: UserRole.DRIVER,
    });

    raised = await EmergencyAlert.create({
      userId: rider.id, alertType: 'panic', raisedCoordinates: point(25.92, -24.65),
      lastCoordinates: point(25.93, -24.66),
    } as any);
    await EmergencyAlert.create({
      userId: rider.id, alertType: 'medical', status: 'resolved',
      raisedCoordinates: point(25.92, -24.65), lastCoordinates: point(25.92, -24.65),
    } as any);

    const pkg = await Package.create({
      senderId: rider.id, title: 'Laptop', pickupAddress: 'Main Mall', dropoffAddress: 'Broadhurst',
      pickupCoordinates: point(25.92, -24.65), dropoffCoordinates: point(25.94, -24.63),
      senderPriceOffer: 40, packageSize: 'small', isActive: true,
    } as any);
    const agreement = await DeliveryAgreement.create({
      packageId: pkg.id, courierId: driver.id, agreedPrice: 40, platformFee: 10, escrowAmount: 0,
      currency: 'BWP', status: 'disputed', paymentMethod: 'cash_on_delivery',
    } as any);
    await DeliveryDispute.create({
      deliveryAgreementId: agreement.id, raisedByUserId: rider.id,
      disputeType: 'package_damaged', description: 'Screen cracked on arrival',
    } as any);

    for (const documentType of ['drivers_license', 'vehicle_registration']) {
      await DriverDocument.create({
        userId: driver.id, documentType, storageKey: `test/${documentType}.jpg`,
        originalFilename: `${documentType}.jpg`, mimeType: 'image/jpeg', fileSizeBytes: 1024,
      } as any);
    }
  });

  const as = (token: string) => ({
    get: (path: string) => request(app).get(path).set('Authorization', `Bearer ${token}`),
    post: (path: string, body: object = {}) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  });

  it('lists what is waiting on an operator, with real counts', async () => {
    const response = await as(adminToken).get('/api/admin/alerts').expect(200);
    const data = response.body.data;

    expect(data.counts).toEqual({ sos: 1, disputes: 1, verifications: 1, cashDisputes: 0, reports: 0, total: 3 });
    expect(data.sos).toHaveLength(1);
    expect(data.sos[0]).toMatchObject({ id: raised.id, alertType: 'panic', status: 'raised', userName: 'Lesedi Rider' });
    expect(data.sos[0].latitude).toBeCloseTo(-24.66);
    expect(data.sos[0].longitude).toBeCloseTo(25.93);
    expect(data.disputes[0]).toMatchObject({ disputeType: 'package_damaged', status: 'open', packageTitle: 'Laptop' });
    expect(data.verifications[0]).toMatchObject({ userName: 'Tumelo Driver', documents: 2 });
  });

  it('requires an admin', async () => {
    await request(app).get('/api/admin/alerts').expect(401);
  });

  it('acknowledges a raised alert once', async () => {
    const first = await as(adminToken).post(`/api/admin/emergency-alerts/${raised.id}/acknowledge`).expect(200);
    expect(first.body.data.status).toBe('acknowledged');
    expect(first.body.data.resolutionNote).toContain('ops@test.com');

    await as(adminToken).post(`/api/admin/emergency-alerts/${raised.id}/acknowledge`).expect(409);

    // Still active, so still on the feed.
    const feed = await as(adminToken).get('/api/admin/alerts').expect(200);
    expect(feed.body.data.counts.sos).toBe(1);
  });

  it('resolves an alert with a note, which takes it off the feed', async () => {
    const response = await as(adminToken)
      .post(`/api/admin/emergency-alerts/${raised.id}/resolve`, { outcome: 'resolved', note: 'Called rider, safe at home' })
      .expect(200);

    expect(response.body.data.status).toBe('resolved');
    expect(response.body.data.resolutionNote).toContain('Called rider, safe at home');

    const feed = await as(adminToken).get('/api/admin/alerts').expect(200);
    expect(feed.body.data.counts.sos).toBe(0);
  });

  it('can close an alert as a false alarm', async () => {
    const response = await as(adminToken)
      .post(`/api/admin/emergency-alerts/${raised.id}/resolve`, { outcome: 'false_alarm', note: 'Pressed by mistake' })
      .expect(200);
    expect(response.body.data.status).toBe('false_alarm');
  });

  it('refuses to resolve without a note or a valid outcome', async () => {
    await as(adminToken).post(`/api/admin/emergency-alerts/${raised.id}/resolve`, { outcome: 'resolved' }).expect(400);
    await as(adminToken).post(`/api/admin/emergency-alerts/${raised.id}/resolve`, { outcome: 'deleted', note: 'x' }).expect(400);
  });

  it('lets a moderator act on SOS alerts, so an emergency does not wait for a higher role', async () => {
    await as(moderatorToken).post(`/api/admin/emergency-alerts/${raised.id}/acknowledge`).expect(200);
  });

  it('answers 404 for an alert that does not exist', async () => {
    await as(adminToken)
      .post('/api/admin/emergency-alerts/00000000-0000-4000-8000-000000000000/acknowledge')
      .expect(404);
  });
});
