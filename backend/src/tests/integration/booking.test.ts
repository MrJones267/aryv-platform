/**
 * @fileoverview Integration tests for booking system
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import request from 'supertest';
import app from '../../index';
import { sequelize } from '../../config/database';
import User from '../../models/User';
import Ride from '../../models/Ride';
import Booking from '../../models/Booking';
import Vehicle from '../../models/Vehicle';
import { BookingStatus, RideStatus } from '../../types';
import jwt from 'jsonwebtoken';

describe('Booking System Integration Tests', () => {
  let driverUser: any;
  let passengerUser: any;
  let driverToken: string;
  let passengerToken: string;
  let vehicle: any;
  let ride: any;
  let booking: any;

  beforeAll(async () => {
    // Wait for database connection
    await sequelize.authenticate();
  });

  beforeEach(async () => {
    // Clean up database
    await Booking.destroy({ where: {}, force: true });
    await Ride.destroy({ where: {}, force: true });
    await Vehicle.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });

    // Create test users
    driverUser = await User.create({
      firstName: 'John',
      lastName: 'Driver',
      email: 'driver@test.com',
      phoneNumber: '+1234567890',
      passwordHash: 'hashedpassword',
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    passengerUser = await User.create({
      firstName: 'Jane',
      lastName: 'Passenger',
      email: 'passenger@test.com',
      phoneNumber: '+1234567891',
      passwordHash: 'hashedpassword',
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    // Create JWT tokens
    driverToken = jwt.sign({ id: driverUser.id }, process.env['JWT_SECRET']!);
    passengerToken = jwt.sign({ id: passengerUser.id }, process.env['JWT_SECRET']!);

    // Create vehicle for driver
    vehicle = await Vehicle.create({
      driverId: driverUser.id,
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
      color: 'Blue',
      licensePlate: 'ABC123',
      capacity: 4,
      isVerified: true,
      isActive: true,
    });

    // Create a ride
    ride = await Ride.create({
      driverId: driverUser.id,
      vehicleId: vehicle.id,
      originAddress: '123 Start St, City',
      originCoordinates: {
        type: 'Point',
        coordinates: [-74.006, 40.7128],
      },
      destinationAddress: '456 End Ave, City',
      destinationCoordinates: {
        type: 'Point',
        coordinates: [-73.9857, 40.7484],
      },
      departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      availableSeats: 3,
      pricePerSeat: 25.00,
      estimatedDuration: 30,
      distance: 15.5,
      status: RideStatus.PENDING,
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /api/rides/:id/book - Create Booking', () => {
    it('should create a new booking successfully', async () => {
      const bookingData = {
        seatsRequested: 2,
        pickupAddress: '123 Start St, City',
        dropoffAddress: '456 End Ave, City',
        specialRequests: 'Please wait outside',
      };

      const response = await request(app)
        .post(`/api/rides/${ride.id}/book`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .send(bookingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.seatsBooked).toBe(2);
      expect(response.body.data.status).toBe(BookingStatus.PENDING);
      expect(response.body.data.totalAmount).toBe(52.5); // 2 seats * $25 + 5% platform fee
      expect(response.body.data.passengerId).toBe(passengerUser.id);
      expect(response.body.data.rideId).toBe(ride.id);

      // Verify booking was saved in database
      const savedBooking = await Booking.findByPk(response.body.data.id);
      expect(savedBooking).toBeTruthy();
      expect(savedBooking!.specialRequests).toBe('Please wait outside');
    });

    it('should prevent driver from booking their own ride', async () => {
      const bookingData = {
        seatsRequested: 1,
        pickupAddress: '123 Start St, City',
        dropoffAddress: '456 End Ave, City',
      };

      const response = await request(app)
        .post(`/api/rides/${ride.id}/book`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send(bookingData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('CANNOT_BOOK_OWN_RIDE');
    });

    it('should prevent booking more seats than available', async () => {
      const bookingData = {
        seatsRequested: 5, // More than the 3 available
        pickupAddress: '123 Start St, City',
        dropoffAddress: '456 End Ave, City',
      };

      const response = await request(app)
        .post(`/api/rides/${ride.id}/book`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .send(bookingData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INSUFFICIENT_SEATS');
    });

    it('should prevent duplicate bookings for the same ride', async () => {
      // Create first booking
      await Booking.create({
        rideId: ride.id,
        passengerId: passengerUser.id,
        seatsBooked: 1,
        totalAmount: 26.25,
        platformFee: 1.25,
        status: BookingStatus.PENDING,
      });

      const bookingData = {
        seatsRequested: 1,
        pickupAddress: '123 Start St, City',
        dropoffAddress: '456 End Ave, City',
      };

      const response = await request(app)
        .post(`/api/rides/${ride.id}/book`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .send(bookingData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('BOOKING_EXISTS');
    });
  });

  describe('GET /api/bookings/my-bookings - Get User Bookings', () => {
    beforeEach(async () => {
      // Create a booking for testing
      booking = await Booking.create({
        rideId: ride.id,
        passengerId: passengerUser.id,
        seatsBooked: 2,
        totalAmount: 52.5,
        platformFee: 2.5,
        status: BookingStatus.PENDING,
        pickupAddress: '123 Start St, City',
        dropoffAddress: '456 End Ave, City',
      });
    });

    it('should get passenger bookings', async () => {
      const response = await request(app)
        .get('/api/bookings/my-bookings?type=passenger')
        .set('Authorization', `Bearer ${passengerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toHaveLength(1);
      expect(response.body.data.bookings[0].userType).toBe('passenger');
      expect(response.body.data.bookings[0].ride.driver).toBeTruthy();
    });

    it('should get driver bookings', async () => {
      const response = await request(app)
        .get('/api/bookings/my-bookings?type=driver')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toHaveLength(1);
      expect(response.body.data.bookings[0].userType).toBe('driver');
      expect(response.body.data.bookings[0].passenger).toBeTruthy();
    });

    it('should filter bookings by status', async () => {
      // Create another booking with different status
      await Booking.create({
        rideId: ride.id,
        passengerId: passengerUser.id,
        seatsBooked: 1,
        totalAmount: 26.25,
        platformFee: 1.25,
        status: BookingStatus.CONFIRMED,
      });

      const response = await request(app)
        .get('/api/bookings/my-bookings?type=passenger&status=confirmed')
        .set('Authorization', `Bearer ${passengerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toHaveLength(1);
      expect(response.body.data.bookings[0].status).toBe(BookingStatus.CONFIRMED);
    });
  });

  describe('POST /api/bookings/:id/confirm - Confirm Booking', () => {
    beforeEach(async () => {
      booking = await Booking.create({
        rideId: ride.id,
        passengerId: passengerUser.id,
        seatsBooked: 2,
        totalAmount: 52.5,
        platformFee: 2.5,
        status: BookingStatus.PENDING,
      });
    });

    it('should allow driver to confirm booking', async () => {
      const response = await request(app)
        .post(`/api/bookings/${booking.id}/confirm`)
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(BookingStatus.CONFIRMED);

      // Verify in database
      const updatedBooking = await Booking.findByPk(booking.id);
      expect(updatedBooking!.status).toBe(BookingStatus.CONFIRMED);
    });

    it('should prevent passenger from confirming booking', async () => {
      const response = await request(app)
        .post(`/api/bookings/${booking.id}/confirm`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('should prevent confirming non-pending booking', async () => {
      await booking.update({ status: BookingStatus.CONFIRMED });

      const response = await request(app)
        .post(`/api/bookings/${booking.id}/confirm`)
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('BOOKING_NOT_PENDING');
    });
  });

  describe('POST /api/bookings/:id/cancel - Cancel Booking', () => {
    beforeEach(async () => {
      booking = await Booking.create({
        rideId: ride.id,
        passengerId: passengerUser.id,
        seatsBooked: 2,
        totalAmount: 52.5,
        platformFee: 2.5,
        status: BookingStatus.PENDING,
      });
    });

    it('should allow passenger to cancel booking', async () => {
      const cancelData = {
        reason: 'Change of plans, cannot make it',
      };

      const response = await request(app)
        .post(`/api/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .send(cancelData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(BookingStatus.CANCELLED);
      expect(response.body.data.cancelReason).toBe(cancelData.reason);
    });

    it('should allow driver to cancel booking', async () => {
      const cancelData = {
        reason: 'Vehicle maintenance required',
      };

      const response = await request(app)
        .post(`/api/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send(cancelData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(BookingStatus.CANCELLED);
    });

    it('should require cancellation reason', async () => {
      const response = await request(app)
        .post(`/api/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/bookings/:id - Update Booking', () => {
    beforeEach(async () => {
      booking = await Booking.create({
        rideId: ride.id,
        passengerId: passengerUser.id,
        seatsBooked: 2,
        totalAmount: 52.5,
        platformFee: 2.5,
        status: BookingStatus.PENDING,
        pickupAddress: 'Original pickup',
        specialRequests: 'Original request',
      });
    });

    it('should allow passenger to update pickup/dropoff addresses', async () => {
      const updateData = {
        pickupAddress: 'New pickup address',
        dropoffAddress: 'New dropoff address',
        specialRequests: 'Updated special requests',
      };

      const response = await request(app)
        .put(`/api/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pickupAddress).toBe(updateData.pickupAddress);
      expect(response.body.data.dropoffAddress).toBe(updateData.dropoffAddress);
      expect(response.body.data.specialRequests).toBe(updateData.specialRequests);
    });

    it('should allow passenger to update seat count', async () => {
      const updateData = {
        seatsBooked: 1, // Reduce from 2 to 1
      };

      const response = await request(app)
        .put(`/api/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.seatsBooked).toBe(1);
      expect(response.body.data.totalAmount).toBe(26.25); // Recalculated amount
    });

    it('should prevent updating seat count beyond availability', async () => {
      const updateData = {
        seatsBooked: 5, // More than available
      };

      const response = await request(app)
        .put(`/api/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INSUFFICIENT_SEATS');
    });

    it('should allow driver to update booking status', async () => {
      const updateData = {
        status: BookingStatus.CONFIRMED,
      };

      const response = await request(app)
        .put(`/api/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(BookingStatus.CONFIRMED);
    });
  });

  describe('POST /api/bookings/:id/rate - Rate Booking', () => {
    beforeEach(async () => {
      booking = await Booking.create({
        rideId: ride.id,
        passengerId: passengerUser.id,
        seatsBooked: 2,
        totalAmount: 52.5,
        platformFee: 2.5,
        status: BookingStatus.COMPLETED, // Must be completed to rate
      });
    });

    it('should allow passenger to rate completed booking', async () => {
      const ratingData = {
        rating: 5,
        review: 'Excellent ride! Driver was punctual and friendly.',
      };

      const response = await request(app)
        .post(`/api/bookings/${booking.id}/rate`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .send(ratingData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.ratingGiven).toBe(5);
      expect(response.body.data.reviewText).toBe(ratingData.review);
    });

    it('should prevent driver from rating booking', async () => {
      const ratingData = {
        rating: 5,
        review: 'Good passenger',
      };

      const response = await request(app)
        .post(`/api/bookings/${booking.id}/rate`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send(ratingData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('should validate rating range', async () => {
      const ratingData = {
        rating: 6, // Invalid rating (1-5 allowed)
        review: 'Test review',
      };

      const response = await request(app)
        .post(`/api/bookings/${booking.id}/rate`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .send(ratingData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Payment Integration', () => {
    beforeEach(async () => {
      booking = await Booking.create({
        rideId: ride.id,
        passengerId: passengerUser.id,
        seatsBooked: 2,
        totalAmount: 52.5,
        platformFee: 2.5,
        status: BookingStatus.CONFIRMED,
      });
    });

    it('should create payment intent for confirmed booking', async () => {
      const response = await request(app)
        .get(`/api/bookings/${booking.id}/payment-intent`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toMatch(/^pi_/);
      expect(response.body.data.client_secret).toBeTruthy();
      expect(response.body.data.amount).toBe(5250); // Amount in cents
      expect(response.body.data.currency).toBe('usd');
    });

    it('should prevent creating payment intent for non-confirmed booking', async () => {
      await booking.update({ status: BookingStatus.PENDING });

      const response = await request(app)
        .get(`/api/bookings/${booking.id}/payment-intent`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('BOOKING_NOT_CONFIRMED');
    });

    it('should confirm payment successfully', async () => {
      // First create payment intent
      const paymentResponse = await request(app)
        .get(`/api/bookings/${booking.id}/payment-intent`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .expect(200);

      const paymentIntentId = paymentResponse.body.data.id;

      // Then confirm payment
      const confirmResponse = await request(app)
        .post(`/api/bookings/${booking.id}/payment-confirm`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({ paymentIntentId })
        .expect(200);

      expect(confirmResponse.body.success).toBe(true);
      expect(confirmResponse.body.message).toBe('Payment confirmed successfully');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent booking gracefully', async () => {
      const fakeBookingId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .get(`/api/bookings/${fakeBookingId}`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('BOOKING_NOT_FOUND');
    });

    it('should require authentication for all booking endpoints', async () => {
      const response = await request(app)
        .get('/api/bookings/my-bookings')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('should validate booking ID format', async () => {
      const response = await request(app)
        .get('/api/bookings/invalid-id')
        .set('Authorization', `Bearer ${passengerToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});