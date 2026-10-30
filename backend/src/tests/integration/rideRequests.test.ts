/**
 * @fileoverview Integration tests for ride requests drivers can see
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * A passenger posts a request; verified drivers near the pickup see it; a
 * ride that fits it (near both ends, in order, around the right time, with
 * the seats and within the price) tells the passenger once; a ride elsewhere
 * does not. The old version measured "20 km" in degrees, so everything
 * matched everything.
 */

import request from 'supertest';
import app from '../../index';
import { User, Vehicle } from '../../models';
import { AuthService } from '../../services/AuthService';
import { notificationService } from '../../services/NotificationService';
import rideRequestService from '../../services/RideRequestService';
import { UserRole, VehicleType } from '../../types';

const GABORONE = { latitude: -24.6541, longitude: 25.9086, address: 'Main Mall, Gaborone' };
const FRANCISTOWN = { latitude: -21.1700, longitude: 27.5100, address: 'Francistown bus rank' };
const MAUN = { latitude: -19.9833, longitude: 23.4167, address: 'Maun' };
const KASANE = { latitude: -17.8000, longitude: 25.1500, address: 'Kasane' };

describe('Ride requests', () => {
  let passenger: any;
  let driver: any;
  let vehicle: any;
  let sent: jest.SpyInstance;
  const token = (u: any) => AuthService.generateAccessToken({ userId: u.id, email: u.email, role: u.role });
  const tomorrowAt = (hour: number) => { const d = new Date(Date.now() + 86400000); d.setUTCHours(hour, 0, 0, 0); return d; };

  const post = (body: object, as = passenger) =>
    request(app).post('/api/ride-requests').set('Authorization', `Bearer ${token(as)}`).send(body);
  const nearby = (place: { latitude: number; longitude: number }, as = driver) =>
    request(app).get('/api/ride-requests/nearby').query({ latitude: place.latitude, longitude: place.longitude })
      .set('Authorization', `Bearer ${token(as)}`);
  const publish = (from: typeof GABORONE, to: typeof GABORONE, departure: Date, price = 150, seats = 3) =>
    request(app).post('/api/rides').set('Authorization', `Bearer ${token(driver)}`).send({
      originAddress: from.address, originCoordinates: { latitude: from.latitude, longitude: from.longitude },
      destinationAddress: to.address, destinationCoordinates: { latitude: to.latitude, longitude: to.longitude },
      departureTime: departure.toISOString(), availableSeats: seats, pricePerSeat: price, vehicleId: vehicle.id,
    });
  const waitForNotifications = async (count: number) => {
    for (let i = 0; i < 40 && sent.mock.calls.filter(c => c[1]?.type === 'ride_request_match').length < count; i++) {
      await new Promise(r => setTimeout(r, 50));
    }
    return sent.mock.calls.filter(c => c[1]?.type === 'ride_request_match');
  };

  beforeEach(async () => {
    // The setup file empties every table before each test.
    sent = jest.spyOn(notificationService, 'sendToUser').mockResolvedValue(undefined);
    passenger = await User.create({
      email: 'neo@test.com', password: 'Integration-Test-Password-1!', firstName: 'Neo', lastName: 'Kgosi', role: UserRole.PASSENGER,
    } as any);
    driver = await User.create({
      email: 'tumi@test.com', password: 'Integration-Test-Password-1!', firstName: 'Tumi', lastName: 'Driver', role: UserRole.DRIVER,
      driverVerificationStatus: 'verified',
    } as any);
    vehicle = await Vehicle.create({
      driverId: driver.id, make: 'Toyota', model: 'Quantum', year: 2020, color: 'White',
      licensePlate: 'B456DEF', capacity: 14, type: VehicleType.VAN, isVerified: true,
    } as any);
  });

  afterEach(() => sent.mockRestore());

  const gaboroneToFrancistown = () => post({
    origin: GABORONE, destination: FRANCISTOWN, departureTime: tomorrowAt(6).toISOString(), passengers: 2, maxPrice: 200,
    description: 'Two of us with one bag',
  });

  it('saves a request the passenger can list and cancel', async () => {
    const created = await gaboroneToFrancistown().expect(201);
    expect(created.body.data).toMatchObject({ status: 'active', passengers: 2, maxPrice: 200, origin: { address: 'Main Mall, Gaborone' } });

    const mine = await request(app).get('/api/ride-requests/my-requests').set('Authorization', `Bearer ${token(passenger)}`).expect(200);
    expect(mine.body.data.requests).toHaveLength(1);

    await request(app).patch(`/api/ride-requests/${created.body.data.id}/cancel`).set('Authorization', `Bearer ${token(passenger)}`).expect(200);
    await request(app).patch(`/api/ride-requests/${created.body.data.id}/cancel`).set('Authorization', `Bearer ${token(passenger)}`).expect(400);
    expect((await nearby(GABORONE).expect(200)).body.data).toEqual([]);
  });

  it('refuses a departure in the past', async () => {
    const res = await post({ origin: GABORONE, destination: FRANCISTOWN, departureTime: new Date(Date.now() - 60000).toISOString(), passengers: 1 }).expect(400);
    expect(res.body.code).toBe('INVALID_DEPARTURE_TIME');
  });

  it('shows verified drivers the requests near them, with only rough locations and a first name', async () => {
    await gaboroneToFrancistown().expect(201);

    const near = await nearby({ latitude: -24.63, longitude: 25.92 }).expect(200);
    expect(near.body.data).toHaveLength(1);
    expect(near.body.data[0]).toMatchObject({
      passengerFirstName: 'Neo', passengers: 2, maxPrice: 200, description: 'Two of us with one bag',
      origin: { address: 'Main Mall, Gaborone', coordinates: [25.91, -24.65] },
    });
    expect(JSON.stringify(near.body.data[0])).not.toContain('Kgosi');

    expect((await nearby(MAUN).expect(200)).body.data).toEqual([]);

    const unverified = await User.create({
      email: 'kago@test.com', password: 'Integration-Test-Password-1!', firstName: 'Kago', lastName: 'New', role: UserRole.DRIVER,
    } as any);
    expect((await nearby(GABORONE, unverified).expect(403)).body.code).toBe('DRIVER_NOT_VERIFIED');
  });

  it('tells the passenger, once, when a ride that fits is published, and not for a ride elsewhere', async () => {
    const created = await gaboroneToFrancistown().expect(201);

    await publish(MAUN, KASANE, tomorrowAt(6)).expect(201);
    const fitting = await publish(GABORONE, FRANCISTOWN, tomorrowAt(7)).expect(201);

    const calls = await waitForNotifications(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]![0]).toBe(passenger.id);
    expect(calls[0]![1].data).toEqual({ rideId: fitting.body.data.id, requestId: created.body.data.id });

    // Announced once, even if matching runs again for the same ride.
    await rideRequestService.notifyMatchesForRide(fitting.body.data.id);
    expect((await waitForNotifications(2))).toHaveLength(1);

    const matches = await request(app).get(`/api/ride-requests/${created.body.data.id}/matches`)
      .set('Authorization', `Bearer ${token(passenger)}`).expect(200);
    expect(matches.body.data.map((r: any) => r.id)).toEqual([fitting.body.data.id]);
  });

  it('does not match a ride going the other way, too dear, too full, or on another day', async () => {
    await gaboroneToFrancistown().expect(201);

    await publish(FRANCISTOWN, GABORONE, tomorrowAt(6)).expect(201);           // reversed
    await publish(GABORONE, FRANCISTOWN, tomorrowAt(6), 350).expect(201);      // over max price
    await publish(GABORONE, FRANCISTOWN, tomorrowAt(6), 150, 1).expect(201);   // one seat, two wanted
    await publish(GABORONE, FRANCISTOWN, tomorrowAt(14)).expect(201);          // eight hours later

    expect(await waitForNotifications(1)).toHaveLength(0);
  });
});
