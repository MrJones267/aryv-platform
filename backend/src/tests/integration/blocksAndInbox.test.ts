/**
 * @fileoverview Integration tests for blocking people and the notification inbox
 * @author Oabona-Majoko
 * @created 2026-10-31
 * @lastModified 2026-10-31
 *
 * "Block" in chat only left the screen. A block now stops the two booking
 * each other's rides, hides each other's rides in search and ride
 * requests, and hides the blocked person's messages from the blocker. The
 * inbox only listed the few notifications saved elsewhere; everything the
 * server sends is now kept for it.
 */

import request from 'supertest';
import app from '../../index';
import { User, Ride, Vehicle } from '../../models';
import GroupChat, { GroupChatType } from '../../models/GroupChat';
import GroupChatParticipant from '../../models/GroupChatParticipant';
import GroupChatMessage from '../../models/GroupChatMessage';
import { AuthService } from '../../services/AuthService';
import { notificationService } from '../../services/NotificationService';
import { RideStatus, UserRole, VehicleType } from '../../types';

describe('Blocking and the inbox', () => {
  let driver: any;
  let passenger: any;
  let ride: any;
  const token = (u: any) => AuthService.generateAccessToken({ userId: u.id, email: u.email, role: u.role });
  const as = (u: any) => ({ Authorization: `Bearer ${token(u)}` });
  const block = (by: any, who: any) => request(app).post('/api/blocks').set(as(by)).send({ userId: who.id });
  const tomorrow = new Date(Date.now() + 86400000);

  beforeEach(async () => {
    // The setup file empties every table before each test.
    const mk = (email: string, firstName: string, role = UserRole.PASSENGER) => User.create({
      email, password: 'Integration-Test-Password-1!', firstName, lastName: 'Test', role,
    } as any);
    driver = await mk('tumi@test.com', 'Tumi', UserRole.DRIVER);
    passenger = await mk('neo@test.com', 'Neo');
    const vehicle = await Vehicle.create({
      driverId: driver.id, make: 'Toyota', model: 'Corolla', year: 2019, color: 'White',
      licensePlate: 'B123ABC', capacity: 4, type: VehicleType.SEDAN, isVerified: true,
    } as any);
    ride = await Ride.create({
      driverId: driver.id, vehicleId: vehicle.id,
      originAddress: 'Main Mall, Gaborone', originCoordinates: { type: 'Point', coordinates: [25.9086, -24.6541] },
      destinationAddress: 'Francistown bus rank', destinationCoordinates: { type: 'Point', coordinates: [27.51, -21.17] },
      departureTime: tomorrow, availableSeats: 3, pricePerSeat: 150, status: RideStatus.PENDING, currency: 'BWP',
    } as any);
  });

  describe('blocking', () => {
    it('lists, unblocks, and refuses blocking yourself', async () => {
      await block(passenger, driver).expect(201);
      await block(passenger, driver).expect(201);
      const list = await request(app).get('/api/blocks').set(as(passenger)).expect(200);
      expect(list.body.data.blocks).toEqual([expect.objectContaining({ userId: driver.id, firstName: 'Tumi' })]);
      await request(app).delete(`/api/blocks/${driver.id}`).set(as(passenger)).expect(200);
      expect((await request(app).get('/api/blocks').set(as(passenger)).expect(200)).body.data.blocks).toEqual([]);
      expect((await block(passenger, passenger).expect(400)).body.code).toBe('CANNOT_BLOCK_SELF');
    });

    it.each([['the passenger blocked the driver', true], ['the driver blocked the passenger', false]])(
      'stops the booking when %s', async (_label, passengerBlocks) => {
        await (passengerBlocks ? block(passenger, driver) : block(driver, passenger)).expect(201);
        const res = await request(app).post(`/api/rides/${ride.id}/book`).set(as(passenger)).send({ seatsRequested: 1 }).expect(403);
        expect(res.body.code).toBe('BLOCKED');
      });

    it('hides a blocked driver\'s rides from a signed-in passenger, not from everyone', async () => {
      const search = (headers: Record<string, string>) => request(app).get('/api/rides/search').set(headers).query({
        originLat: -24.6541, originLng: 25.9086, destinationLat: -21.17, destinationLng: 27.51,
        departureDate: tomorrow.toISOString(), radius: 20,
      });
      const ids = (res: any) => res.body.data.rides.map((r: any) => r.id);
      expect(ids(await search(as(passenger)).expect(200))).toContain(ride.id);
      await block(driver, passenger).expect(201);
      expect(ids(await search(as(passenger)).expect(200))).not.toContain(ride.id);
      expect(ids(await search({}).expect(200))).toContain(ride.id);
    });

    it('hides a blocked person\'s messages from the one who blocked them', async () => {
      const chat = await GroupChat.create({ name: 'Trip', type: GroupChatType.CUSTOM_GROUP, createdBy: driver.id } as any);
      await GroupChatParticipant.create({ groupChatId: chat.id, userId: driver.id } as any);
      await GroupChatParticipant.create({ groupChatId: chat.id, userId: passenger.id } as any);
      await GroupChatMessage.create({ groupChatId: chat.id, senderId: driver.id, content: 'From the driver' } as any);
      await GroupChatMessage.create({ groupChatId: chat.id, senderId: passenger.id, content: 'From the passenger' } as any);
      await block(passenger, driver).expect(201);

      const texts = async (u: any) => (await request(app).get(`/api/group-chats/${chat.id}/messages`).set(as(u)).expect(200))
        .body.data.messages.map((m: any) => m.content);
      expect(await texts(passenger)).toEqual(['From the passenger']);
      expect((await texts(driver)).sort()).toEqual(['From the driver', 'From the passenger']);
    });
  });

  describe('inbox', () => {
    it('keeps what the server sends, with its real type and text', async () => {
      await notificationService.sendToUser(passenger.id, {
        type: 'ride_request_match', title: 'A ride for your request', message: 'Book a seat before it fills.',
        data: { rideId: ride.id }, timestamp: new Date().toISOString(),
      });
      const res = await request(app).get('/api/notifications').set(as(passenger)).expect(200);
      expect(res.body.data.notifications).toEqual([expect.objectContaining({
        type: 'ride_request_match', title: 'A ride for your request', message: 'Book a seat before it fills.', readAt: null,
        data: expect.objectContaining({ rideId: ride.id }),
      })]);
      expect(res.body.data.pagination.unreadCount).toBe(1);
      // Nobody else sees it.
      expect((await request(app).get('/api/notifications').set(as(driver)).expect(200)).body.data.notifications).toEqual([]);
    });
  });
});
