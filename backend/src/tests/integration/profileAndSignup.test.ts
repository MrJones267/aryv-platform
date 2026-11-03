/**
 * @fileoverview Integration tests for loading a profile and signing up
 * @author Oabona-Majoko
 * @created 2026-11-03
 * @lastModified 2026-11-03
 *
 * - GET /api/users/profile selected vehicles.seatingCapacity, a column that
 *   does not exist, so it failed for every user and the app showed "Server
 *   Error" straight after signing in.
 * - POST /api/auth/register refused the country and currency the app sends
 *   from the phone number's country, so most sign-ups from the app failed.
 */

import request from 'supertest';
import app from '../../index';
import { User, Vehicle } from '../../models';
import { AuthService } from '../../services/AuthService';
import { UserRole, VehicleType } from '../../types';

describe('Profile and sign-up', () => {
  const token = (u: any) => AuthService.generateAccessToken({ userId: u.id, email: u.email, role: u.role });

  it('loads the profile of a driver with a vehicle', async () => {
    const driver = await User.create({
      email: 'kagiso@test.com', password: 'Integration-Test-Password-1!', firstName: 'Kagiso', lastName: 'Test', role: UserRole.DRIVER,
    } as any);
    await Vehicle.create({
      driverId: driver.id, make: 'Toyota', model: 'Quantum', year: 2020, color: 'White',
      licensePlate: 'B789GHI', capacity: 14, type: VehicleType.MINIVAN, isVerified: true,
    } as any);

    const res = await request(app).get('/api/users/profile').set('Authorization', `Bearer ${token(driver)}`).expect(200);

    expect(res.body.data).toEqual(expect.objectContaining({ firstName: 'Kagiso', role: UserRole.DRIVER }));
    expect(res.body.data.vehicles).toEqual([expect.objectContaining({ make: 'Toyota', capacity: 14 })]);
    expect(res.body.data.password).toBeUndefined();
  });

  it('loads the profile of a passenger with no vehicle', async () => {
    const passenger = await User.create({
      email: 'naledi@test.com', password: 'Integration-Test-Password-1!', firstName: 'Naledi', lastName: 'Test', role: UserRole.PASSENGER,
    } as any);
    const res = await request(app).get('/api/users/profile').set('Authorization', `Bearer ${token(passenger)}`).expect(200);
    expect(res.body.data).toEqual(expect.objectContaining({ firstName: 'Naledi', vehicles: [] }));
  });

  it('signs up with the country and currency the app sends, and keeps the details', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'Thabo@Test.com', password: 'Strong#Pass1', phone: '+26771234567',
      firstName: 'Thabo', lastName: 'Molefe', role: 'passenger', country: 'bw', currency: 'BWP',
    }).expect(201);

    const user = await User.findOne({ where: { email: 'thabo@test.com' } }) ?? await User.findOne({ where: { email: 'Thabo@Test.com' } });
    expect(user).toEqual(expect.objectContaining({ firstName: 'Thabo', lastName: 'Molefe', phone: '+26771234567', countryCode: 'BW' }));

    const profile = await request(app).get('/api/users/profile')
      .set('Authorization', `Bearer ${res.body.data.accessToken}`).expect(200);
    expect(profile.body.data).toEqual(expect.objectContaining({ firstName: 'Thabo', lastName: 'Molefe', countryCode: 'BW' }));
  });

  it('still refuses a malformed country', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'lesego@test.com', password: 'Strong#Pass1', phone: '+26771234568',
      firstName: 'Lesego', lastName: 'Test', country: 'Botswana',
    }).expect(400);
    expect(res.body.details.map((d: any) => d.field)).toContain('country');
  });
});
