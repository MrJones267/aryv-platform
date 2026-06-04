/**
 * @fileoverview Unit tests for BookingController
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import { Response } from 'express';
import { BookingController } from '../../controllers/BookingController';
import { AuthenticatedRequest } from '../../types';
import { BookingStatus, RideStatus } from '../../types';

jest.mock('../../models/Booking');
jest.mock('../../models/Ride');
jest.mock('../../models/User');
jest.mock('../../models/Vehicle');
jest.mock('../../config/database', () => ({
  sequelize: {
    transaction: jest.fn(() => ({
      commit: jest.fn(),
      rollback: jest.fn(),
    })),
    fn: jest.fn(),
    col: jest.fn(),
    // Returned stub lets model files load under automock without a real DB.
    define: jest.fn(() => ({
      findAll: jest.fn(), findByPk: jest.fn(), findOne: jest.fn(),
      findAndCountAll: jest.fn(), count: jest.fn(), create: jest.fn(),
      update: jest.fn(), destroy: jest.fn(), sum: jest.fn(), max: jest.fn(),
      belongsTo: jest.fn(), hasMany: jest.fn(), hasOne: jest.fn(), belongsToMany: jest.fn(),
      beforeCreate: jest.fn(), beforeUpdate: jest.fn(), beforeSave: jest.fn(),
      afterCreate: jest.fn(), afterUpdate: jest.fn(), afterSave: jest.fn(),
      addHook: jest.fn(), addScope: jest.fn(), sync: jest.fn(), prototype: {},
    })),
  },
}));
jest.mock('../../services/PaymentService', () => ({ paymentService: { createPaymentIntent: jest.fn() } }));
jest.mock('../../services/NotificationService', () => ({ notificationService: { notifyBookingUpdate: jest.fn() } }));

import Booking from '../../models/Booking';

const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockRequest = (overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest => ({
  user: { id: 'passenger-1', email: 'passenger@test.com', role: 'passenger' as any },
  params: {},
  query: {},
  body: {},
  headers: {},
  ...overrides,
} as AuthenticatedRequest);

describe('BookingController', () => {
  let controller: BookingController;

  beforeEach(() => {
    controller = new BookingController();
    jest.clearAllMocks();
  });

  describe('getMyBookings', () => {
    it('returns 401 when unauthenticated', async () => {
      const req = mockRequest({ user: undefined as any });
      const res = mockResponse();

      await controller.getMyBookings(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns paginated bookings', async () => {
      (Booking.findAll as jest.Mock).mockResolvedValue([]);
      const req = mockRequest({ query: { page: '1', limit: '10', type: 'passenger' } });
      const res = mockResponse();

      await controller.getMyBookings(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            pagination: expect.objectContaining({ page: 1, limit: 10 }),
          }),
        })
      );
    });

    it('defaults to page 1 limit 20', async () => {
      (Booking.findAll as jest.Mock).mockResolvedValue([]);
      const req = mockRequest({ query: {} });
      const res = mockResponse();

      await controller.getMyBookings(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pagination: expect.objectContaining({ page: 1, limit: 20 }),
          }),
        })
      );
    });
  });

  describe('cancelBooking', () => {
    it('returns 401 when unauthenticated', async () => {
      const req = mockRequest({ user: undefined as any, params: { id: 'booking-1' } });
      const res = mockResponse();

      await controller.cancelBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 404 when booking not found', async () => {
      (Booking.findByPk as jest.Mock).mockResolvedValueOnce(null);
      const req = mockRequest({ params: { id: 'nonexistent' } });
      const res = mockResponse();

      await controller.cancelBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 403 when user tries to cancel another users booking', async () => {
      (Booking.findByPk as jest.Mock).mockResolvedValueOnce({
        id: 'booking-1',
        passengerId: 'other-user',
        status: BookingStatus.CONFIRMED,
        ride: { driverId: 'driver-1', status: RideStatus.CONFIRMED },
      });
      const req = mockRequest({ params: { id: 'booking-1' } });
      const res = mockResponse();

      await controller.cancelBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 400 when booking is already cancelled', async () => {
      (Booking.findByPk as jest.Mock).mockResolvedValueOnce({
        id: 'booking-1',
        passengerId: 'passenger-1',
        status: BookingStatus.CANCELLED,
        ride: { driverId: 'driver-1', status: RideStatus.CONFIRMED },
      });
      const req = mockRequest({ params: { id: 'booking-1' } });
      const res = mockResponse();

      await controller.cancelBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getBookingById', () => {
    it('returns 401 when unauthenticated', async () => {
      const req = mockRequest({ user: undefined as any, params: { id: 'booking-1' } });
      const res = mockResponse();

      await controller.getBookingById(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 404 for nonexistent booking', async () => {
      (Booking.findByPk as jest.Mock).mockResolvedValueOnce(null);
      const req = mockRequest({ params: { id: 'nonexistent' } });
      const res = mockResponse();

      await controller.getBookingById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns booking data for the owner', async () => {
      const mockBooking = {
        id: 'booking-1',
        passengerId: 'passenger-1',
        rideId: 'ride-1',
        status: BookingStatus.CONFIRMED,
        toJSON: () => ({ id: 'booking-1', passengerId: 'passenger-1' }),
      };
      (Booking.findByPk as jest.Mock).mockResolvedValueOnce(mockBooking);
      const req = mockRequest({ params: { id: 'booking-1' } });
      const res = mockResponse();

      await controller.getBookingById(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });
});
