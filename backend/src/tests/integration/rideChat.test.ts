/**
 * @fileoverview Integration tests for a ride's chat
 * @author Oabona-Majoko
 * @created 2026-10-31
 * @lastModified 2026-10-31
 *
 * Ride details and booking opened a chat called `ride-<id>`, which is not a
 * chat, and nothing ever made a ride's chat. Separately, every system notice
 * ("created the group", "joined") was saved with sender 'system', which the
 * sender column refuses, so making or joining any chat failed.
 */

import request from 'supertest';
import app from '../../index';
import { User, Ride, Booking, Vehicle } from '../../models';
import { AuthService } from '../../services/AuthService';
import { BookingStatus, RideStatus, UserRole, VehicleType } from '../../types';

describe('Ride chat', () => {
  let driver: any;
  let passenger: any;
  let outsider: any;
  let ride: any;
  const token = (u: any) => AuthService.generateAccessToken({ userId: u.id, email: u.email, role: u.role });
  const open = (as: any) => request(app).post(`/api/group-chats/rides/${ride.id}/open`).set('Authorization', `Bearer ${token(as)}`);

  beforeEach(async () => {
    // The setup file empties every table before each test.
    const mk = (email: string, firstName: string, role = UserRole.PASSENGER) => User.create({
      email, password: 'Integration-Test-Password-1!', firstName, lastName: 'Test', role,
    } as any);
    driver = await mk('tumi@test.com', 'Tumi', UserRole.DRIVER);
    passenger = await mk('neo@test.com', 'Neo');
    outsider = await mk('kago@test.com', 'Kago');
    const vehicle = await Vehicle.create({
      driverId: driver.id, make: 'Toyota', model: 'Corolla', year: 2019, color: 'White',
      licensePlate: 'B123ABC', capacity: 4, type: VehicleType.SEDAN, isVerified: true,
    } as any);
    ride = await Ride.create({
      driverId: driver.id, vehicleId: vehicle.id,
      originAddress: 'Main Mall, Gaborone', originCoordinates: { type: 'Point', coordinates: [25.9086, -24.6541] },
      destinationAddress: 'Francistown bus rank', destinationCoordinates: { type: 'Point', coordinates: [27.51, -21.17] },
      departureTime: new Date(Date.now() + 86400000), availableSeats: 3, pricePerSeat: 150, status: RideStatus.PENDING, currency: 'BWP',
    } as any);
    await Booking.create({ rideId: ride.id, passengerId: passenger.id, seatsBooked: 1, totalAmount: 157.5, platformFee: 7.5, currency: 'BWP', status: BookingStatus.CONFIRMED } as any);
  });

  it('gives the driver and the passenger the same chat, and they can talk', async () => {
    const first = await open(passenger).expect(200);
    const id = first.body.data.groupChatId;
    expect(first.body.data.name).toBe('Main Mall, Gaborone → Francistown bus rank');
    expect((await open(driver).expect(200)).body.data.groupChatId).toBe(id);

    await request(app).post(`/api/group-chats/${id}/messages`).set('Authorization', `Bearer ${token(passenger)}`)
      .send({ content: 'I am at the bus stop by Choppies' }).expect(201);
    const messages = await request(app).get(`/api/group-chats/${id}/messages`).set('Authorization', `Bearer ${token(driver)}`).expect(200);
    const said = messages.body.data.messages.find((m: any) => m.content === 'I am at the bus stop by Choppies');
    expect(said).toMatchObject({ senderId: passenger.id, senderName: 'Neo Test' });
    expect(said.timestamp).toBeTruthy();
  });

  it('is only for people on the ride', async () => {
    expect((await open(outsider).expect(403)).body.code).toBe('NOT_ON_RIDE');
    await request(app).post('/api/group-chats/rides/00000000-0000-4000-8000-000000000000/open')
      .set('Authorization', `Bearer ${token(passenger)}`).expect(404);
  });

  it('adds someone who booked after the chat was made', async () => {
    const id = (await open(driver).expect(200)).body.data.groupChatId;
    await Booking.create({ rideId: ride.id, passengerId: outsider.id, seatsBooked: 1, totalAmount: 157.5, platformFee: 7.5, currency: 'BWP', status: BookingStatus.PENDING } as any);
    expect((await open(outsider).expect(200)).body.data.groupChatId).toBe(id);
    await request(app).post(`/api/group-chats/${id}/messages`).set('Authorization', `Bearer ${token(outsider)}`)
      .send({ content: 'Hello, I booked the last seat' }).expect(201);
  });

  it('makes an ordinary group chat too, now that its system notice saves', async () => {
    await request(app).post('/api/group-chats').set('Authorization', `Bearer ${token(passenger)}`)
      .send({ name: 'Weekend trips', type: 'custom_group' }).expect(201);
  });
});
