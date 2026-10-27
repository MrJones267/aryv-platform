/**
 * @fileoverview Integration tests for the admin analytics endpoints
 * @author Oabona-Majoko
 * @created 2026-10-27
 * @lastModified 2026-10-27
 *
 * The admin Analytics page drew invented data. These cover the endpoints it
 * now reads, and top-routes in particular, whose query referred to columns
 * that do not exist and averaged prices across currencies.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../index';
import { User, Vehicle, Ride, Package, DeliveryAgreement } from '../../models';
import { AdminUser } from '../../models/AdminUser';
import { RideStatus, UserRole, VehicleType } from '../../types';

const point = (lng: number, lat: number) => ({ type: 'Point', coordinates: [lng, lat] });

describe('Admin analytics', () => {
  let token: string;

  beforeEach(async () => {
    // The setup file empties every table before each test.
    const admin = await AdminUser.createAdmin({
      email: 'analyst@test.com',
      password: 'Integration-Test-Password-1!',
      firstName: 'Ana',
      lastName: 'Lyst',
      role: 'admin',
      permissions: ['analytics.read'],
    });
    token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, permissions: admin.permissions, type: 'admin' },
      process.env['ADMIN_JWT_SECRET']!,
      { expiresIn: '1h' }
    );

    const driver = await User.create({
      email: 'driver@test.com',
      password: 'Integration-Test-Password-1!',
      firstName: 'Thabo',
      lastName: 'Driver',
      role: UserRole.DRIVER,
    });
    const vehicle = await Vehicle.create({
      driverId: driver.id,
      make: 'Toyota',
      model: 'Corolla',
      year: 2020,
      color: 'White',
      licensePlate: 'B 123 ABC',
      capacity: 4,
      type: VehicleType.SEDAN,
    });

    const ride = (from: string, to: string, price: number, currency: string, status = RideStatus.COMPLETED) =>
      Ride.create({
        driverId: driver.id,
        vehicleId: vehicle.id,
        originAddress: from,
        originCoordinates: point(25.92, -24.62),
        destinationAddress: to,
        destinationCoordinates: point(25.86, -24.62),
        // The model only accepts departures after server start; analytics
        // reads status, not the date.
        departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        availableSeats: 3,
        pricePerSeat: price,
        currency,
        estimatedDuration: 30,
        distance: 12,
        status,
      } as any);

    await ride('Main Mall, Gaborone', 'Mogoditshane Mall', 20, 'BWP');
    await ride('Main Mall, Gaborone', 'Mogoditshane Mall', 30, 'BWP');
    await ride('Main Mall, Gaborone', 'Mogoditshane Mall', 40, 'ZAR');
    await ride('Main Mall, Gaborone', 'Tlokweng Border Post', 15, 'BWP');
    await ride('Main Mall, Gaborone', 'Tlokweng Border Post', 99, 'BWP', RideStatus.CANCELLED);
  });

  const get = (path: string) => request(app).get(path).set('Authorization', `Bearer ${token}`);

  it('ranks completed routes, keeping each currency separate', async () => {
    const response = await get('/api/admin/analytics/top-routes').expect(200);

    expect(response.body.data).toEqual([
      { origin: 'Main Mall, Gaborone', destination: 'Mogoditshane Mall', currency: 'BWP', tripCount: 2, avgPricePerSeat: 25 },
      { origin: 'Main Mall, Gaborone', destination: 'Mogoditshane Mall', currency: 'ZAR', tripCount: 1, avgPricePerSeat: 40 },
      { origin: 'Main Mall, Gaborone', destination: 'Tlokweng Border Post', currency: 'BWP', tripCount: 1, avgPricePerSeat: 15 },
    ]);
  });

  it('honours the limit', async () => {
    const response = await get('/api/admin/analytics/top-routes?limit=1').expect(200);
    expect(response.body.data).toHaveLength(1);
  });

  it('reports usage from real counts', async () => {
    const response = await get('/api/admin/analytics/usage').expect(200);
    expect(response.body.data.rides.total).toBe(5);
    expect(response.body.data.rides.completed).toBe(4);
  });

  describe('courier packages', () => {
    beforeEach(async () => {
      const sender = await User.create({
        email: 'sender@test.com', password: 'Integration-Test-Password-1!',
        firstName: 'Kago', lastName: 'Sender', role: UserRole.PASSENGER,
      });
      const courier = await User.create({
        email: 'courier@test.com', password: 'Integration-Test-Password-1!',
        firstName: 'Neo', lastName: 'Courier', role: UserRole.DRIVER,
      });
      const pkg = (title: string, extra: Record<string, unknown> = {}) =>
        Package.create({
          senderId: sender.id, title, pickupAddress: 'Main Mall', dropoffAddress: 'Tlokweng Border Post',
          pickupCoordinates: point(25.92, -24.65), dropoffCoordinates: point(25.97, -24.67),
          senderPriceOffer: 40, packageSize: 'small', isActive: true, ...extra,
        } as any);

      await pkg('Still listed');
      await pkg('Lapsed', { isActive: false });
      const delivered = await pkg('Delivered', { currency: 'ZAR' });
      await DeliveryAgreement.create({
        packageId: delivered.id, courierId: courier.id, agreedPrice: 60, platformFee: 15,
        escrowAmount: 0, currency: 'ZAR', status: 'completed', paymentMethod: 'cash_on_delivery',
      } as any);
    });

    it('lists packages with the state their agreement or listing gives them', async () => {
      const response = await get('/api/admin/courier/packages').expect(200);
      const byTitle = Object.fromEntries(response.body.data.packages.map((p: any) => [p.title, p]));

      expect(response.body.data.pagination.total).toBe(3);
      expect(byTitle['Still listed'].status).toBe('open');
      expect(byTitle['Lapsed'].status).toBe('expired');
      expect(byTitle['Delivered'].status).toBe('completed');
      expect(byTitle['Delivered'].courierName).toBe('Neo Courier');
      expect(byTitle['Delivered'].senderName).toBe('Kago Sender');
      expect(byTitle['Still listed'].courierName).toBeNull();
    });

    it('filters by state, and rejects a state that does not exist', async () => {
      const response = await get('/api/admin/courier/packages?status=open').expect(200);
      expect(response.body.data.packages.map((p: any) => p.title)).toEqual(['Still listed']);

      await get('/api/admin/courier/packages?status=delivered').expect(400);
    });

    it('counts packages by state and keeps delivery money per currency', async () => {
      const response = await get('/api/admin/courier/stats').expect(200);

      expect(response.body.data.total).toBe(3);
      expect(response.body.data.byState).toMatchObject({ open: 1, expired: 1, completed: 1, in_transit: 0 });
      expect(response.body.data.completedByCurrency).toEqual([
        { currency: 'ZAR', deliveries: 1, value: 60, platformFees: 15 },
      ]);
    });
  });

  it('buckets signups by day for user growth', async () => {
    const response = await get('/api/admin/analytics/user-growth/30d').expect(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].newUsers).toBe(1);
    expect(response.body.data[0].totalUsers).toBe(1);
  });
});
