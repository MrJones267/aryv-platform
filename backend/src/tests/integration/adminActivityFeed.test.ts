/**
 * @fileoverview Integration tests for the dashboard's recent activity feed
 * @author Oabona-Majoko
 * @created 2026-10-29
 * @lastModified 2026-10-29
 *
 * The dashboard's Recent Activity showed invented people, then said it was
 * not connected. These create one of each kind of event and check the feed
 * reports them, newest first, with who did it.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../index';
import { User, Vehicle, Ride, Booking, Package, DeliveryAgreement, DeliveryDispute } from '../../models';
import { AdminUser } from '../../models/AdminUser';
import EmergencyAlert from '../../models/EmergencyAlert';
import DriverDocument from '../../models/DriverDocument';
import { RideStatus, UserRole, VehicleType } from '../../types';

const point = (lng: number, lat: number) => ({ type: 'Point', coordinates: [lng, lat] });
const pause = () => new Promise(r => setTimeout(r, 25));

describe('Admin activity feed', () => {
  let token: string;

  beforeEach(async () => {
    // The setup file empties every table before each test.
    const admin = await AdminUser.createAdmin({
      email: 'ops@test.com', password: 'Integration-Test-Password-1!',
      firstName: 'Ops', lastName: 'Admin', role: 'moderator', permissions: ['users.read'],
    });
    token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, permissions: admin.permissions, type: 'admin' },
      process.env['ADMIN_JWT_SECRET']!,
      { expiresIn: '1h' }
    );

    // Created in order, a little apart, so newest-first is unambiguous.
    const driver = await User.create({ email: 'driver@test.com', password: 'Integration-Test-Password-1!', firstName: 'Tumelo', lastName: 'Driver', role: UserRole.DRIVER });
    await pause();
    const rider = await User.create({ email: 'rider@test.com', password: 'Integration-Test-Password-1!', firstName: 'Lesedi', lastName: 'Rider', role: UserRole.PASSENGER });
    await pause();
    const vehicle = await Vehicle.create({ driverId: driver.id, make: 'Toyota', model: 'Corolla', year: 2020, color: 'White', licensePlate: 'B 1 ABC', capacity: 4, type: VehicleType.SEDAN });
    const ride = await Ride.create({
      driverId: driver.id, vehicleId: vehicle.id,
      originAddress: 'Main Mall, Gaborone', originCoordinates: point(25.92, -24.65),
      destinationAddress: 'Mogoditshane Mall', destinationCoordinates: point(25.86, -24.62),
      departureTime: new Date(Date.now() + 86_400_000), availableSeats: 3, pricePerSeat: 25,
      estimatedDuration: 30, distance: 12, status: RideStatus.PENDING,
    } as any);
    await pause();
    await Booking.create({ rideId: ride.id, passengerId: rider.id, seatsBooked: 2, totalAmount: 52.5, platformFee: 2.5 } as any);
    await pause();
    const pkg = await Package.create({
      senderId: rider.id, title: 'Laptop', pickupAddress: 'Main Mall', dropoffAddress: 'Broadhurst',
      pickupCoordinates: point(25.92, -24.65), dropoffCoordinates: point(25.94, -24.63),
      senderPriceOffer: 40, packageSize: 'small', isActive: true,
    } as any);
    await pause();
    const agreement = await DeliveryAgreement.create({
      packageId: pkg.id, courierId: driver.id, agreedPrice: 40, platformFee: 10, escrowAmount: 0,
      currency: 'BWP', status: 'completed', paymentMethod: 'cash_on_delivery', deliveryConfirmedAt: new Date(),
    } as any);
    await pause();
    await DeliveryDispute.create({ deliveryAgreementId: agreement.id, raisedByUserId: rider.id, disputeType: 'package_damaged', description: 'Cracked screen' } as any);
    await pause();
    await DriverDocument.create({ userId: driver.id, documentType: 'drivers_license', storageKey: 'k.jpg', mimeType: 'image/jpeg', fileSizeBytes: 9 } as any);
    await pause();
    await EmergencyAlert.create({ userId: rider.id, alertType: 'panic', raisedCoordinates: point(25.92, -24.65), lastCoordinates: point(25.92, -24.65) } as any);
  });

  const feed = (query = '') => request(app).get(`/api/admin/activity-feed${query}`).set('Authorization', `Bearer ${token}`);

  it('reports each kind of event, newest first, with who did it', async () => {
    const response = await feed().expect(200);
    const events = response.body.data.events;

    expect(events.map((e: any) => e.type)).toEqual([
      'sos_raised', 'document_submitted', 'dispute_raised', 'delivery_completed',
      'package_listed', 'seats_booked', 'ride_posted', 'user_signup', 'user_signup',
    ]);
    expect(events[0]).toMatchObject({ actor: 'Lesedi Rider', detail: 'panic (raised)', entityType: 'emergency_alert' });
    expect(events.find((e: any) => e.type === 'ride_posted')).toMatchObject({ actor: 'Tumelo Driver', detail: 'Main Mall, Gaborone → Mogoditshane Mall' });
    expect(events.find((e: any) => e.type === 'seats_booked').detail).toContain('2 seat(s)');
  });

  it('honours the limit', async () => {
    const response = await feed('?limit=3').expect(200);
    expect(response.body.data.events.map((e: any) => e.type)).toEqual(['sos_raised', 'document_submitted', 'dispute_raised']);
  });

  it('requires an admin', async () => {
    await request(app).get('/api/admin/activity-feed').expect(401);
  });
});
