/**
 * @fileoverview Integration tests for failures seen in production on 2026-11-03
 * @author Oabona-Majoko
 * @created 2026-11-03
 * @lastModified 2026-11-03
 *
 * - Accepting a delivery answered 500 for everyone: FOR UPDATE was applied
 *   to the sender, the nullable side of a LEFT JOIN, which Postgres refuses.
 * - A package's details screen asked for GET /courier/packages/:id, which
 *   did not exist.
 * - Profile photos from the app were refused with 400: the app sends the
 *   field `profilePicture` and only `avatar` was accepted.
 * - A ride between towns named alone ("Maun", "Gaborone") was refused: the
 *   address had to be at least 10 characters.
 */

import request from 'supertest';
import app from '../../index';
import { User, Vehicle } from '../../models';
import CourierProfile from '../../models/CourierProfile';
import DemandPricingEngine from '../../services/DemandPricingEngine';
import { AuthService } from '../../services/AuthService';
import { UserRole, VehicleType } from '../../types';

const token = (u: any) => AuthService.generateAccessToken({ userId: u.id, email: u.email, role: u.role });
const as = (u: any) => ({ Authorization: `Bearer ${token(u)}` });

const mk = (email: string, firstName: string, role = UserRole.PASSENGER) => User.create({
  email, password: 'Integration-Test-Password-1!', firstName, lastName: 'Test', role,
} as any);

describe('Courier: accepting and opening a package', () => {
  let sender: any;
  let courier: any;
  let other: any;
  let packageId: string;

  beforeEach(async () => {
    // The setup file empties every table before each test.
    sender = await mk('kago@test.com', 'Kago');
    courier = await mk('lesedi@test.com', 'Lesedi');
    other = await mk('tumelo@test.com', 'Tumelo');
    await DemandPricingEngine.getInstance().initializeDefaultTiers();
    const created = await request(app).post('/api/courier/packages').set(as(sender)).send({
      title: 'Documents for the bank', description: 'A4 envelope', packageSize: 'small',
      pickupAddress: 'Main Mall, Gaborone', pickupCoordinates: [25.9231, -24.6282],
      dropoffAddress: 'Mogoditshane', dropoffCoordinates: [25.8656, -24.6269],
      pickupContactName: 'Kago', pickupContactPhone: '+26771000001',
      dropoffContactName: 'Bank clerk', dropoffContactPhone: '+26771000002',
      senderPriceOffer: 45,
    }).expect(201);
    packageId = created.body.data.package.id;
  });

  it('accepts a delivery for an active courier', async () => {
    await CourierProfile.create({ userId: courier.id, isCourierActive: true, isAvailableForDeliveries: true } as any);
    await request(app).post(`/api/courier/packages/${packageId}/accept`).set(as(courier)).expect(201);
  });

  it('refuses someone who is not a courier, rather than failing with 500', async () => {
    const res = await request(app).post(`/api/courier/packages/${packageId}/accept`).set(as(other)).expect(403);
    expect(res.body.error).toBe('User is not an active courier');
  });

  it('shows the sender the whole package', async () => {
    const res = await request(app).get(`/api/courier/packages/${packageId}`).set(as(sender)).expect(200);
    expect(res.body.data).toEqual(expect.objectContaining({
      id: packageId, title: 'Documents for the bank', viewerRole: 'sender', isOpen: true, dropoffContactPhone: '+26771000002',
    }));
  });

  it('shows a courier browsing an open package without its contacts', async () => {
    const res = await request(app).get(`/api/courier/packages/${packageId}`).set(as(other)).expect(200);
    expect(res.body.data).toEqual(expect.objectContaining({ id: packageId, viewerRole: 'browsing', isOpen: true }));
    expect(res.body.data.pickupContactPhone).toBeUndefined();
    expect(res.body.data.dropoffContactPhone).toBeUndefined();
  });

  it('keeps a taken package to its sender and its courier', async () => {
    await CourierProfile.create({ userId: courier.id, isCourierActive: true, isAvailableForDeliveries: true } as any);
    await request(app).post(`/api/courier/packages/${packageId}/accept`).set(as(courier)).expect(201);

    const mine = await request(app).get(`/api/courier/packages/${packageId}`).set(as(courier)).expect(200);
    expect(mine.body.data).toEqual(expect.objectContaining({ viewerRole: 'courier', dropoffContactPhone: '+26771000002' }));
    await request(app).get(`/api/courier/packages/${packageId}`).set(as(other)).expect(404);
  });
});

describe('Profile photo from the app', () => {
  it('takes the photo under the field name the app sends', async () => {
    const user = await mk('neo@test.com', 'Neo');
    const res = await request(app).post('/api/auth/upload-profile-picture').set(as(user))
      .attach('profilePicture', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), { filename: 'profile.jpg', contentType: 'image/jpeg' })
      .expect(200);
    expect(JSON.stringify(res.body)).toContain('/uploads/avatars/');
    expect((await User.findByPk(user.id))!.profilePicture).toContain('/uploads/avatars/');
  });

  it('still takes it under `avatar`', async () => {
    const user = await mk('mpho@test.com', 'Mpho');
    await request(app).post('/api/auth/upload-profile-picture').set(as(user))
      .attach('avatar', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), { filename: 'me.jpg', contentType: 'image/jpeg' })
      .expect(200);
  });
});

describe('Offering a ride between towns', () => {
  it('accepts a town name alone as the address', async () => {
    const driver = await mk('thato@test.com', 'Thato', UserRole.DRIVER);
    const vehicle = await Vehicle.create({
      driverId: driver.id, make: 'Toyota', model: 'Corolla', year: 2019, color: 'White',
      licensePlate: 'B321XYZ', capacity: 4, type: VehicleType.SEDAN, isVerified: true,
    } as any);
    await request(app).post('/api/rides').set(as(driver)).send({
      originAddress: 'Maun', originCoordinates: { latitude: -19.9833, longitude: 23.4167 },
      destinationAddress: 'Gaborone', destinationCoordinates: { latitude: -24.6282, longitude: 25.9231 },
      departureTime: new Date(Date.now() + 86400000).toISOString(), availableSeats: 3, pricePerSeat: 350, vehicleId: vehicle.id,
    }).expect(201);
  });
});
