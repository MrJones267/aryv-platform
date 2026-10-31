/**
 * @fileoverview Integration tests for the queries that measure distance
 * @author Oabona-Majoko
 * @created 2026-10-31
 * @lastModified 2026-10-31
 *
 * Two bugs, in most of these queries at once:
 *
 * - sequelize.col() was given attribute names ('originCoordinates',
 *   'pricePerSeat', 'totalAmount'). col() does not translate them, the
 *   columns are snake_case, and the query failed. Ride search returned 500
 *   to everyone; demand and price suggestions caught the error and quietly
 *   answered "nothing nearby".
 * - ST_DWithin was given metres on plain 4326 geometry, whose unit is
 *   degrees, so a 20 km radius covered the planet. A surge zone around
 *   Gaborone priced rides in Maun.
 *
 * Each test puts one ride near the point asked about and one in Maun, about
 * 600 km away, and expects only the near one to count.
 */

import request from 'supertest';
import app from '../../index';
import { sequelize } from '../../config/database';
import { User, Ride, Vehicle, Booking } from '../../models';
import { AuthService } from '../../services/AuthService';
import { surgeService } from '../../services/SurgeService';
import { BookingStatus, RideStatus, UserRole, VehicleType } from '../../types';

const point = (lng: number, lat: number) => ({ type: 'Point', coordinates: [lng, lat] });
const GABORONE = { lat: -24.6541, lng: 25.9086 };
const FRANCISTOWN = { lat: -21.17, lng: 27.51 };
const MAUN = { lat: -19.98, lng: 23.42 };

describe('Queries that measure distance', () => {
  let driver: any;
  let passenger: any;
  let vehicle: any;
  const token = (u: any) => AuthService.generateAccessToken({ userId: u.id, email: u.email, role: u.role });
  const as = (u: any) => ({ Authorization: `Bearer ${token(u)}` });

  const rideFrom = (from: { lat: number; lng: number }, extra: Record<string, unknown> = {}) => Ride.create({
    driverId: driver.id, vehicleId: vehicle.id,
    originAddress: `Pickup at ${from.lat}`, originCoordinates: point(from.lng, from.lat),
    destinationAddress: 'Francistown bus rank', destinationCoordinates: point(FRANCISTOWN.lng, FRANCISTOWN.lat),
    departureTime: new Date(Date.now() + 2 * 3600000), availableSeats: 3, pricePerSeat: 150,
    status: RideStatus.PENDING, currency: 'BWP', ...extra,
  } as any);

  beforeEach(async () => {
    const mk = (email: string, firstName: string, role = UserRole.PASSENGER) => User.create({
      email, password: 'Integration-Test-Password-1!', firstName, lastName: 'Test', role,
    } as any);
    driver = await mk('kabo@test.com', 'Kabo', UserRole.DRIVER);
    passenger = await mk('lesedi@test.com', 'Lesedi');
    vehicle = await Vehicle.create({
      driverId: driver.id, make: 'Toyota', model: 'Corolla', year: 2019, color: 'White',
      licensePlate: 'B456DEF', capacity: 4, type: VehicleType.SEDAN, isVerified: true,
    } as any);
  });

  it('ride search finds the ride nearby and not the one in Maun', async () => {
    const near = await rideFrom(GABORONE);
    const far = await rideFrom(MAUN);
    const res = await request(app).get('/api/rides/search').query({
      originLat: GABORONE.lat, originLng: GABORONE.lng,
      destinationLat: FRANCISTOWN.lat, destinationLng: FRANCISTOWN.lng,
      departureDate: new Date(Date.now() - 3600000).toISOString(), radius: 20,
    }).expect(200);
    const ids = res.body.data.rides.map((r: any) => r.id);
    expect(ids).toContain(near.id);
    expect(ids).not.toContain(far.id);
  });

  it('demand counts seats near the driver, not across the country', async () => {
    await rideFrom(GABORONE);
    await rideFrom(MAUN);
    const res = await request(app).get('/api/rides/demand').set(as(driver))
      .query({ latitude: GABORONE.lat, longitude: GABORONE.lng }).expect(200);
    expect(res.body.data.ridesConsidered).toBe(1);
  });

  it('price suggestions learn from fares on this route only', async () => {
    const done = { status: RideStatus.COMPLETED };
    for (const price of [100, 110, 120, 130]) {await rideFrom(GABORONE, { ...done, pricePerSeat: price });}
    for (const price of [900, 900, 900, 900]) {await rideFrom(MAUN, { ...done, pricePerSeat: price });}
    const res = await request(app).get('/api/rides/price-suggestion').set(as(driver)).query({
      originLat: GABORONE.lat, originLng: GABORONE.lng,
      destinationLat: FRANCISTOWN.lat, destinationLng: FRANCISTOWN.lng,
    }).expect(200);
    expect(res.body.data.sampleSize).toBe(4);
    expect(res.body.data.suggested).toBe(115);
  });

  it('a surge zone applies inside its radius and not 600 km away', async () => {
    await sequelize.query(
      `INSERT INTO surge_periods (name, starts_at, ends_at, multiplier, centre, radius_metres)
       VALUES ('Gaborone test rush', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '1 hour', 1.5,
               ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), 20000)`,
      { replacements: GABORONE },
    );
    try {
      expect((await surgeService.getSurge(new Date(), { latitude: GABORONE.lat, longitude: GABORONE.lng })).multiplier).toBe(1.5);
      expect((await surgeService.getSurge(new Date(), { latitude: MAUN.lat, longitude: MAUN.lng })).multiplier).toBe(1);
    } finally {
      // The setup only truncates tables that have a model; this one has none.
      await sequelize.query(`DELETE FROM surge_periods WHERE name = 'Gaborone test rush'`);
    }
  });

  it('popular routes count and average completed rides', async () => {
    const done = { status: RideStatus.COMPLETED };
    await rideFrom(GABORONE, { ...done, pricePerSeat: 100 });
    await rideFrom(GABORONE, { ...done, pricePerSeat: 140 });
    const res = await request(app).get('/api/rides/popular-routes').set(as(passenger)).expect(200);
    expect(res.body.data[0]).toEqual(expect.objectContaining({ count: 2, averagePrice: 120 }));
  });

  it('a passenger\'s statistics add up what they spent', async () => {
    const ride = await rideFrom(GABORONE);
    await Booking.create({ rideId: ride.id, passengerId: passenger.id, seatsBooked: 1, totalAmount: 26.25, platformFee: 1.25, currency: 'BWP', status: BookingStatus.CONFIRMED } as any);
    await Booking.create({ rideId: ride.id, passengerId: passenger.id, seatsBooked: 1, totalAmount: 30, platformFee: 1.5, currency: 'BWP', status: BookingStatus.CONFIRMED } as any);
    const res = await request(app).get('/api/users/statistics').set(as(passenger)).expect(200);
    expect(res.body.data.asPassenger[BookingStatus.CONFIRMED]).toEqual({ count: 2, totalSpent: 56.25 });
  });
});
