/**
 * @fileoverview Integration tests for closing an account
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * Covers the admin's closure (who may, what it needs, what blocks it) and
 * what any closure erases, which the app's own deletion now shares: personal
 * fields, emergency contacts and identity documents go, every signed-in
 * device is signed out, and the person's rides and bookings stay, anonymised.
 */

import fs from 'fs';
import path from 'path';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../index';
import { User, Ride, Booking, Vehicle } from '../../models';
import { AdminUser } from '../../models/AdminUser';
import EmergencyContact from '../../models/EmergencyContact';
import DriverDocument, { DocumentType } from '../../models/DriverDocument';
import UserWallet from '../../models/UserWallet';
import { UPLOADS_DIR } from '../../middleware/upload';
import { AuthService } from '../../services/AuthService';
import { BookingStatus, RideStatus, UserRole, VehicleType } from '../../types';

describe('Account closure', () => {
  let superToken: string;
  let adminToken: string;
  let user: any;

  const sign = (a: AdminUser) => jwt.sign(
    { id: a.id, email: a.email, role: a.role, permissions: a.permissions, type: 'admin' },
    process.env['ADMIN_JWT_SECRET']!,
    { expiresIn: '1h' },
  );
  // Issued a moment ago, as a phone signed in earlier would hold.
  const userToken = () => AuthService.generateAccessToken({ userId: user.id, email: 'lesedi@test.com', role: UserRole.DRIVER });

  beforeEach(async () => {
    // The setup file empties every table before each test.
    superToken = sign(await AdminUser.createAdmin({
      email: 'owner@test.com', password: 'Integration-Test-Password-1!', firstName: 'Owner', lastName: 'Admin', role: 'super_admin', permissions: [],
    }));
    adminToken = sign(await AdminUser.createAdmin({
      email: 'ops@test.com', password: 'Integration-Test-Password-1!', firstName: 'Ops', lastName: 'Admin', role: 'admin', permissions: [],
    }));
    user = await User.create({
      email: 'lesedi@test.com', password: 'Integration-Test-Password-1!', phone: '+26771234567',
      firstName: 'Lesedi', lastName: 'Molefe', role: UserRole.DRIVER, countryCode: 'BW', address: 'Plot 123, Gaborone',
    } as any);
  });

  const close = (body: object, token = superToken) =>
    request(app).post(`/api/admin/users/${user.id}/close`).set('Authorization', `Bearer ${token}`).send(body);
  const valid = { reason: 'Deletion request received by email', confirmEmail: 'lesedi@test.com' };

  it('erases personal data, documents and contacts, and signs out every device', async () => {
    const before = userToken();
    await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${before}`).expect(200);

    await EmergencyContact.create({ userId: user.id, name: 'Mma Molefe', phone: '+26772222222' } as any);
    const stored = `closure-test-${user.id}.jpg`;
    fs.mkdirSync(path.join(UPLOADS_DIR, 'documents'), { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, 'documents', stored), 'not really an image');
    await DriverDocument.create({
      userId: user.id, documentType: DocumentType.NATIONAL_ID, storageKey: stored, mimeType: 'image/jpeg', fileSizeBytes: 19,
    } as any);

    // A token issued in the same second as the closure must also be refused.
    await new Promise(r => setTimeout(r, 1100));
    await close(valid).expect(200);

    const erased = await User.findByPk(user.id);
    expect(erased).toMatchObject({
      email: `deleted-${user.id}@deleted.aryv-app.com`, phone: null, firstName: 'Deleted', lastName: 'User',
      address: null, status: 'deactivated', deactivationReason: 'closed_by_admin: Deletion request received by email',
    });
    expect(await EmergencyContact.count({ where: { userId: user.id } })).toBe(0);
    expect(await DriverDocument.count({ where: { userId: user.id } })).toBe(0);
    expect(fs.existsSync(path.join(UPLOADS_DIR, 'documents', stored))).toBe(false);

    await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${before}`).expect(401);
    await request(app).post('/api/auth/login').send({ email: 'lesedi@test.com', password: 'Integration-Test-Password-1!' }).expect(401);
  });

  it('keeps the account in other people\'s history, anonymised', async () => {
    const vehicle = await Vehicle.create({
      driverId: user.id, make: 'Toyota', model: 'Corolla', year: 2019, color: 'White',
      licensePlate: 'B123ABC', capacity: 4, type: VehicleType.SEDAN, isVerified: true,
    } as any);
    const ride = await Ride.create({
      driverId: user.id, vehicleId: vehicle.id,
      originAddress: 'Main Mall, Gaborone', originCoordinates: { type: 'Point', coordinates: [25.9086, -24.6541] },
      destinationAddress: 'Game City, Gaborone', destinationCoordinates: { type: 'Point', coordinates: [25.88, -24.678] },
      departureTime: new Date(Date.now() + 3600_000), availableSeats: 3, pricePerSeat: 25, status: RideStatus.PENDING, currency: 'BWP',
    } as any);
    await ride.update({ status: RideStatus.COMPLETED });

    await close(valid).expect(200);
    expect(await Ride.count({ where: { driverId: user.id } })).toBe(1);
  });

  it('is refused while someone else depends on the account, and says why', async () => {
    const vehicle = await Vehicle.create({
      driverId: user.id, make: 'Toyota', model: 'Corolla', year: 2019, color: 'White',
      licensePlate: 'B123ABC', capacity: 4, type: VehicleType.SEDAN, isVerified: true,
    } as any);
    const ride = await Ride.create({
      driverId: user.id, vehicleId: vehicle.id,
      originAddress: 'Main Mall, Gaborone', originCoordinates: { type: 'Point', coordinates: [25.9086, -24.6541] },
      destinationAddress: 'Game City, Gaborone', destinationCoordinates: { type: 'Point', coordinates: [25.88, -24.678] },
      departureTime: new Date(Date.now() + 3600_000), availableSeats: 3, pricePerSeat: 25, status: RideStatus.PENDING, currency: 'BWP',
    } as any);
    const passenger = await User.create({ email: 'p@test.com', password: 'Integration-Test-Password-1!', firstName: 'P', lastName: 'Q', role: UserRole.PASSENGER } as any);
    await Booking.create({ rideId: ride.id, passengerId: passenger.id, seatsBooked: 1, totalAmount: 26.25, platformFee: 1.25, currency: 'BWP', status: BookingStatus.CONFIRMED } as any);
    await UserWallet.create({ userId: user.id, commissionOwed: 12.5 } as any);

    const check = await request(app).get(`/api/admin/users/${user.id}/closure-check`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(check.body.data.blockers.map((b: any) => b.code)).toEqual(['UPCOMING_RIDES', 'COMMISSION_OWED']);

    const refused = await close(valid).expect(409);
    expect(refused.body.code).toBe('ACCOUNT_BUSY');
    expect((await User.findByPk(user.id))!.email).toBe('lesedi@test.com');

    // The passenger's side: their upcoming booking blocks closing their account.
    const passengerCheck = await request(app).get(`/api/admin/users/${passenger.id}/closure-check`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(passengerCheck.body.data.blockers.map((b: any) => b.code)).toEqual(['BOOKED_SEATS']);
  });

  it('needs a super admin, a reason, and the email typed back; and closes once', async () => {
    await close(valid, adminToken).expect(403);
    expect((await close({ confirmEmail: 'lesedi@test.com' }).expect(400)).body.code).toBe('REASON_REQUIRED');
    expect((await close({ ...valid, confirmEmail: 'someone@test.com' }).expect(400)).body.code).toBe('CONFIRMATION_MISMATCH');
    await close({ ...valid, confirmEmail: ' LESEDI@test.com ' }).expect(200);
    expect((await close({ ...valid, confirmEmail: `deleted-${user.id}@deleted.aryv-app.com` }).expect(409)).body.code).toBe('ALREADY_CLOSED');
  });

  it('lets a person delete their own account the same way', async () => {
    await EmergencyContact.create({ userId: user.id, name: 'Mma Molefe', phone: '+26772222222' } as any);
    await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${userToken()}`)
      .send({ password: 'Integration-Test-Password-1!' }).expect(200);
    expect(await User.findByPk(user.id)).toMatchObject({ firstName: 'Deleted', deactivationReason: 'account_deleted_by_user' });
    expect(await EmergencyContact.count({ where: { userId: user.id } })).toBe(0);
  });
});
