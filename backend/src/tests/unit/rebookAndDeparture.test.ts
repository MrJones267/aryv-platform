/**
 * @fileoverview Booking a ride again after cancelling, and not after it has left
 * @author Oabona-Majoko
 * @created 2026-11-10
 * @lastModified 2026-11-10
 */

import { sequelize } from '../../config/database';
import { RideController } from '../../controllers/RideController';
import Ride from '../../models/Ride';
import Booking from '../../models/Booking';
import BookingPin from '../../models/BookingPin';
import User from '../../models/User';
import RideStop from '../../models/RideStop';
import { RideStatus, BookingStatus, UserRole } from '../../types';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  getErrorStack: (e: unknown) => (e instanceof Error ? e.stack : undefined),
}));
jest.mock('../../services/BlockService', () => ({
  __esModule: true,
  default: { isBlockedEitherWay: jest.fn().mockResolvedValue(false) },
  blockService: { isBlockedEitherWay: jest.fn().mockResolvedValue(false) },
}));
jest.mock('../../services/NotificationService', () => ({
  notificationService: { notifyNewBookingRequest: jest.fn().mockResolvedValue(undefined) },
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));

const RIDE = '55555555-5555-4555-8555-555555555555';
const HOUR = 60 * 60 * 1000;
const point = (lng: number, lat: number) => ({ type: 'Point', coordinates: [lng, lat] });

const mockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const request = (): any => ({ params: { id: RIDE }, body: { seatsRequested: 1 }, user: { id: 'passenger-1', role: UserRole.PASSENGER } });

describe('booking a ride', () => {
  const controller = new RideController();
  let create: jest.SpyInstance;

  const rideLeaving = (departureTime: Date) => jest.spyOn(Ride, 'findByPk').mockResolvedValue({
    id: RIDE, driverId: 'driver-1', status: RideStatus.CONFIRMED, availableSeats: 4, pricePerSeat: 100, currency: 'BWP',
    departureTime,
    originAddress: 'Gaborone', originCoordinates: point(25.92, -24.65),
    destinationAddress: 'Francistown', destinationCoordinates: point(27.51, -21.17),
  } as any);

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(sequelize, 'transaction').mockResolvedValue({ commit: jest.fn(), rollback: jest.fn() } as any);
    jest.spyOn(RideStop, 'findAll').mockResolvedValue([]);
    jest.spyOn(Booking, 'findAll').mockResolvedValue([]);
    jest.spyOn(Booking, 'findByPk').mockResolvedValue({ id: 'booking-1' } as any);
    jest.spyOn(User, 'findByPk').mockResolvedValue({ id: 'passenger-1' } as any);
    jest.spyOn(BookingPin, 'destroy').mockResolvedValue(1 as any);
    create = jest.spyOn(Booking, 'create').mockImplementation((async (values: any) => ({ id: 'booking-1', ...values })) as any);
  });

  it('refuses a ride whose departure time has passed', async () => {
    rideLeaving(new Date(Date.now() - HOUR));
    jest.spyOn(Booking, 'findOne').mockResolvedValue(null);
    const res = mockRes();

    await controller.bookRide(request(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'RIDE_DEPARTED' }));
    expect(create).not.toHaveBeenCalled();
  });

  it('brings a cancelled booking back instead of refusing the passenger for good', async () => {
    rideLeaving(new Date(Date.now() + HOUR));
    const cancelled: any = { id: 'booking-1', status: BookingStatus.CANCELLED };
    cancelled.update = jest.fn(async (values: any) => Object.assign(cancelled, values));
    jest.spyOn(Booking, 'findOne').mockResolvedValue(cancelled);
    const res = mockRes();

    await controller.bookRide(request(), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(create).not.toHaveBeenCalled();
    expect(cancelled.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: BookingStatus.PENDING, cancelReason: null, seatsBooked: 1, totalAmount: 105 }),
      expect.anything(),
    );
    expect(BookingPin.destroy).toHaveBeenCalled();
  });

  it('lets a rejected passenger ask once more, and marks that request as used', async () => {
    rideLeaving(new Date(Date.now() + HOUR));
    const rejected: any = { id: 'booking-1', status: BookingStatus.CANCELLED, rejectedByDriver: true, rerequestedAfterRejection: false };
    rejected.update = jest.fn(async (values: any) => Object.assign(rejected, values));
    jest.spyOn(Booking, 'findOne').mockResolvedValue(rejected);
    const res = mockRes();

    await controller.bookRide(request(), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(rejected.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: BookingStatus.PENDING, rerequestedAfterRejection: true }),
      expect.anything(),
    );
  });

  it('refuses a rejected passenger who has already asked again', async () => {
    rideLeaving(new Date(Date.now() + HOUR));
    const rejected: any = { id: 'booking-1', status: BookingStatus.CANCELLED, rejectedByDriver: true, rerequestedAfterRejection: true, update: jest.fn() };
    jest.spyOn(Booking, 'findOne').mockResolvedValue(rejected);
    const res = mockRes();

    await controller.bookRide(request(), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'REQUEST_DECLINED' }));
    expect(rejected.update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('still refuses a second booking while one is live', async () => {
    rideLeaving(new Date(Date.now() + HOUR));
    jest.spyOn(Booking, 'findOne').mockResolvedValue({ id: 'booking-1', status: BookingStatus.PENDING } as any);
    const res = mockRes();

    await controller.bookRide(request(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'BOOKING_EXISTS' }));
  });
});
