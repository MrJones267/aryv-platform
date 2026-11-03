/**
 * @fileoverview Integration tests for My Rides and the list of group chats
 * @author Oabona-Majoko
 * @created 2026-11-03
 * @lastModified 2026-11-03
 *
 * - GET /api/rides/my-rides joined bookings without the `bookings` alias the
 *   association defines, so Sequelize refused it and every call was a 500.
 *   It also answered `asDriver`/`asPassenger` while the app reads `rides`.
 * - GET /api/group-chats/my-chats included a `lastMessage` association that
 *   does not exist (500 for everyone), and spread Sequelize instances into
 *   the response, so a chat arrived without its name.
 */

import request from 'supertest';
import app from '../../index';
import { User, Ride, Booking, Vehicle } from '../../models';
import { AuthService } from '../../services/AuthService';
import { BookingStatus, RideStatus, UserRole, VehicleType } from '../../types';

describe('My Rides and my chats', () => {
  let driver: any;
  let passenger: any;
  let ride: any;
  const token = (u: any) => AuthService.generateAccessToken({ userId: u.id, email: u.email, role: u.role });
  const as = (u: any) => ({ Authorization: `Bearer ${token(u)}` });

  beforeEach(async () => {
    // The setup file empties every table before each test.
    const mk = (email: string, firstName: string, role = UserRole.PASSENGER) => User.create({
      email, password: 'Integration-Test-Password-1!', firstName, lastName: 'Test', role,
    } as any);
    driver = await mk('mpho@test.com', 'Mpho', UserRole.DRIVER);
    passenger = await mk('lorato@test.com', 'Lorato');
    const vehicle = await Vehicle.create({
      driverId: driver.id, make: 'Toyota', model: 'Corolla', year: 2019, color: 'White',
      licensePlate: 'B456DEF', capacity: 4, type: VehicleType.SEDAN, isVerified: true,
    } as any);
    ride = await Ride.create({
      driverId: driver.id, vehicleId: vehicle.id,
      originAddress: 'Main Mall, Gaborone', originCoordinates: { type: 'Point', coordinates: [25.9086, -24.6541] },
      destinationAddress: 'Mahalapye bus rank', destinationCoordinates: { type: 'Point', coordinates: [26.81, -23.1] },
      departureTime: new Date(Date.now() + 86400000), availableSeats: 3, pricePerSeat: 120, status: RideStatus.PENDING, currency: 'BWP',
    } as any);
    await Booking.create({ rideId: ride.id, passengerId: passenger.id, seatsBooked: 1, totalAmount: 126, platformFee: 6, currency: 'BWP', status: BookingStatus.CONFIRMED } as any);
  });

  it('lists the rides a driver offers, with their bookings', async () => {
    const res = await request(app).get('/api/rides/my-rides').set(as(driver)).expect(200);

    expect(res.body.data.rides).toEqual([expect.objectContaining({ id: ride.id, originAddress: 'Main Mall, Gaborone' })]);
    expect(res.body.data.rides[0].bookings).toEqual([expect.objectContaining({ passengerId: passenger.id, seatsBooked: 1 })]);
    expect(res.body.data.pagination).toEqual(expect.objectContaining({ total: 1, totalPages: 1 }));
  });

  it('lists the rides a passenger has booked', async () => {
    const res = await request(app).get('/api/rides/my-rides').set(as(passenger)).expect(200);

    expect(res.body.data.rides).toEqual([]);
    expect(res.body.data.asPassenger).toEqual([expect.objectContaining({ id: ride.id })]);
    expect(res.body.data.pagination.totalAsPassenger).toBe(1);
  });

  it('lists my chats with their name, members and latest message', async () => {
    const id = (await request(app).post(`/api/group-chats/rides/${ride.id}/open`).set(as(passenger)).expect(200)).body.data.groupChatId;
    await request(app).post(`/api/group-chats/${id}/messages`).set(as(passenger))
      .send({ content: 'Leaving from the Main Mall entrance?' }).expect(201);

    const res = await request(app).get('/api/group-chats/my-chats').set(as(driver)).expect(200);

    const chat = res.body.data.groupChats.find((c: any) => c.id === id);
    expect(chat).toEqual(expect.objectContaining({ name: 'Main Mall, Gaborone → Mahalapye bus rank', participantCount: 2 }));
    expect(chat.dataValues).toBeUndefined();
    expect(chat.lastMessage).toEqual(expect.objectContaining({
      content: 'Leaving from the Main Mall entrance?', senderId: passenger.id, senderName: 'Lorato Test',
    }));
  });

  it('lists no chats for someone in none', async () => {
    const res = await request(app).get('/api/group-chats/my-chats').set(as(driver)).expect(200);
    expect(res.body.data.groupChats).toEqual([]);
  });
});
