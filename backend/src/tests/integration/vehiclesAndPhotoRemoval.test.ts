/**
 * @fileoverview Integration tests for registering a vehicle and removing a photo
 * @author Oabona-Majoko
 * @created 2026-11-04
 * @lastModified 2026-11-04
 *
 * - POST /users/vehicles validated vehicleType, seatingCapacity and a
 *   required fuelType, while the model and the app use type and capacity:
 *   every vehicle from the app was refused, so no driver could offer rides.
 * - Removing a profile photo was never sent to the server.
 */

import request from 'supertest';
import app from '../../index';
import { User, Vehicle } from '../../models';
import { AuthService } from '../../services/AuthService';
import { UserRole, VehicleType } from '../../types';

const token = (u: any) => AuthService.generateAccessToken({ userId: u.id, email: u.email, role: u.role });
const as = (u: any) => ({ Authorization: `Bearer ${token(u)}` });

// What the app's DriverOnboarding sends.
const fromApp = (overrides: Record<string, unknown> = {}) => ({
  make: 'Toyota', model: 'Hilux', year: 2019, color: 'White', licensePlate: 'B123ABC', type: 'sedan', capacity: 4,
  ...overrides,
});

describe('Registering a vehicle', () => {
  let driver: any;
  beforeEach(async () => {
    driver = await User.create({
      email: 'kgosi@test.com', password: 'Integration-Test-Password-1!', firstName: 'Kgosi', lastName: 'Test', role: UserRole.DRIVER,
    } as any);
  });

  it('accepts what the app sends', async () => {
    const res = await request(app).post('/api/users/vehicles').set(as(driver)).send(fromApp()).expect(201);
    expect(res.body.data).toEqual(expect.objectContaining({ make: 'Toyota', type: VehicleType.SEDAN, capacity: 4 }));
  });

  it('takes a bakkie, as the pickup it is', async () => {
    const res = await request(app).post('/api/users/vehicles').set(as(driver)).send(fromApp({ type: 'truck', licensePlate: 'B234BCD' })).expect(201);
    expect(res.body.data.type).toBe(VehicleType.PICKUP);
  });

  it('maps a van to a minivan, and still takes the old field names', async () => {
    const body = fromApp({ licensePlate: 'B345CDE' }) as Record<string, unknown>;
    delete body['type'];
    delete body['capacity'];
    const res = await request(app).post('/api/users/vehicles').set(as(driver))
      .send({ ...body, vehicleType: 'Van', seatingCapacity: 7 }).expect(201);
    expect(res.body.data).toEqual(expect.objectContaining({ type: VehicleType.MINIVAN, capacity: 7 }));
  });

  it('refuses a type it cannot store, and says which it can', async () => {
    const res = await request(app).post('/api/users/vehicles').set(as(driver)).send(fromApp({ type: 'hovercraft', licensePlate: 'B456DEF' })).expect(400);
    expect(JSON.stringify(res.body.details)).toContain('pickup');
    expect(await Vehicle.count({ where: { driverId: driver.id } })).toBe(0);
  });
});

describe('Removing a profile photo', () => {
  it('clears it on the server', async () => {
    const user = await User.create({
      email: 'dineo@test.com', password: 'Integration-Test-Password-1!', firstName: 'Dineo', lastName: 'Test', role: UserRole.PASSENGER,
      profilePicture: 'https://api.test.aryv-app.com/uploads/avatars/dineo-1.jpg',
    } as any);
    await request(app).delete('/api/users/profile/avatar').set(as(user)).expect(200);
    expect((await User.findByPk(user.id))!.profilePicture).toBeNull();
  });
});
