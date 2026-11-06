/**
 * @fileoverview Integration tests for the admin panel's ride list
 * @author Oabona-Majoko
 * @created 2026-11-06
 * @lastModified 2026-11-06
 *
 * The Rides page showed "Failed to fetch rides" for every request: the query
 * asked for the vehicle's `vehicleType`, an attribute the Vehicle model does
 * not have (it is `type`, column vehicle_type), so Postgres refused the
 * SELECT. Nothing exercised this endpoint, so the 500 reached production.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../index';
import User from '../../models/User';
import Ride from '../../models/Ride';
import Vehicle from '../../models/Vehicle';
import { AdminUser } from '../../models/AdminUser';
import { RideStatus, UserRole, VehicleType } from '../../types';

describe('GET /api/admin/rides', () => {
  let adminToken: string;

  beforeEach(async () => {
    // The setup file empties every table before each test.
    const admin = await AdminUser.createAdmin({
      email: 'rides-admin@test.com', password: 'Integration-Test-Password-1!',
      firstName: 'Rides', lastName: 'Admin', role: 'admin', permissions: [],
    });
    adminToken = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, permissions: admin.permissions, type: 'admin' },
      process.env['ADMIN_JWT_SECRET']!,
      { expiresIn: '1h' },
    );

    const driver = await User.create({
      email: 'rides-driver@test.com', password: 'Integration-Test-Password-1!',
      firstName: 'Kagiso', lastName: 'Driver', role: UserRole.DRIVER,
    });
    const vehicle = await Vehicle.create({
      driverId: driver.id, make: 'Toyota', model: 'Corolla', year: 2019, color: 'White',
      licensePlate: 'B 123 ABC', capacity: 4, type: VehicleType.SEDAN,
    } as any);
    await Ride.create({
      driverId: driver.id,
      vehicleId: vehicle.id,
      originAddress: 'Main Mall, Gaborone',
      originCoordinates: { type: 'Point', coordinates: [25.9087, -24.6545] },
      destinationAddress: 'Broadhurst, Gaborone',
      destinationCoordinates: { type: 'Point', coordinates: [25.9431, -24.6235] },
      departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      availableSeats: 3,
      pricePerSeat: 25,
      estimatedDuration: 20,
      distance: 6.5,
      status: RideStatus.PENDING,
    } as any);
  });

  it('lists rides with the driver and the vehicle, including its type', async () => {
    const res = await request(app)
      .get('/api/admin/rides?page=1&limit=25')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rides).toHaveLength(1);

    const [ride] = res.body.data.rides;
    expect(ride.driver.firstName).toBe('Kagiso');
    expect(ride.vehicle).toMatchObject({ make: 'Toyota', licensePlate: 'B 123 ABC', type: VehicleType.SEDAN });
  });

  it('refuses a caller without an admin token', async () => {
    const res = await request(app).get('/api/admin/rides');
    expect(res.status).toBe(401);
  });
});
