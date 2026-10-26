/**
 * @fileoverview Booking part of a multi-stop ride, end to end through the controller.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * RideSegmentService.test.ts covers the allocation arithmetic. This covers the
 * booking path that uses it: that a passenger boarding part-way is charged for
 * the part they travel, that their booking records which part that was, and
 * that a full first leg does not block a seat later in the journey.
 *
 * The route throughout is the one the feature exists for:
 *   Francistown → Palapye → Mahalapye → Gaborone, four passenger seats.
 */

import { sequelize } from '../../config/database';
import { RideController } from '../../controllers/RideController';
import Ride from '../../models/Ride';
import Booking from '../../models/Booking';
import User from '../../models/User';
import RideStop from '../../models/RideStop';
import { RideStatus, BookingStatus, UserRole } from '../../types';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
}));
jest.mock('../../services/NotificationService', () => ({
  notificationService: { notifyNewBookingRequest: jest.fn().mockResolvedValue(undefined) },
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));

const PASSENGER = 'passenger-1';
const RIDE = '55555555-5555-4555-8555-555555555555';

const FRANCISTOWN = 0;
const PALAPYE = 1;
const MAHALAPYE = 2;
const GABORONE = 3;

/** Four passenger seats — a five-seater with the driver in one of them. */
const PASSENGER_SEATS = 4;
const FULL_FARE = 150;

const point = (lng: number, lat: number) => ({ type: 'Point', coordinates: [lng, lat] });

const stopRows = [
  { id: 's0', sequence: FRANCISTOWN, address: 'Francistown', coordinates: point(27.51, -21.17), fareFromOrigin: 0 },
  { id: 's1', sequence: PALAPYE, address: 'Palapye', coordinates: point(27.13, -22.55), fareFromOrigin: 60 },
  { id: 's2', sequence: MAHALAPYE, address: 'Mahalapye', coordinates: point(26.83, -23.10), fareFromOrigin: 90 },
  { id: 's3', sequence: GABORONE, address: 'Gaborone', coordinates: point(25.92, -24.65), fareFromOrigin: FULL_FARE },
];

const existing = (from: number, to: number, seats = 1) => ({
  seatsBooked: seats,
  boardingSequence: from,
  alightingSequence: to,
  status: BookingStatus.CONFIRMED,
});

const mockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const request = (body: Record<string, unknown>): any => ({
  params: { id: RIDE },
  body,
  user: { id: PASSENGER, role: UserRole.PASSENGER },
});

describe('booking a leg of a multi-stop ride', () => {
  const controller = new RideController();
  let created: any;

  beforeEach(() => {
    created = undefined;

    jest.spyOn(sequelize, 'transaction').mockResolvedValue({
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    } as any);

    jest.spyOn(Ride, 'findByPk').mockResolvedValue({
      id: RIDE,
      driverId: 'driver-1',
      status: RideStatus.PENDING,
      availableSeats: PASSENGER_SEATS,
      pricePerSeat: FULL_FARE,
      currency: 'BWP',
      originAddress: 'Francistown',
      originCoordinates: point(27.51, -21.17),
      destinationAddress: 'Gaborone',
      destinationCoordinates: point(25.92, -24.65),
    } as any);

    jest.spyOn(RideStop, 'findAll').mockResolvedValue(stopRows as any);
    jest.spyOn(Booking, 'findOne').mockResolvedValue(null);
    jest.spyOn(Booking, 'sum').mockResolvedValue(0 as any);
    jest.spyOn(Booking, 'findByPk').mockResolvedValue({ id: 'booking-1' } as any);
    jest.spyOn(User, 'findByPk').mockResolvedValue({ id: PASSENGER } as any);
    jest.spyOn(Booking, 'create').mockImplementation((async (values: any) => {
      created = values;
      return { id: 'booking-1', ...values };
    }) as any);
  });

  const withExistingBookings = (bookings: unknown[]) => {
    jest.spyOn(Booking, 'findAll').mockResolvedValue(bookings as any);
  };

  /** The ride as described: four aboard from Francistown, two alighting early. */
  const asDescribed = [
    existing(FRANCISTOWN, PALAPYE),
    existing(FRANCISTOWN, MAHALAPYE),
    existing(FRANCISTOWN, GABORONE),
    existing(FRANCISTOWN, GABORONE),
  ];

  it('records which part of the journey the passenger booked', async () => {
    withExistingBookings([]);

    await controller.bookRide(
      request({ seatsRequested: 1, boardingStop: FRANCISTOWN, alightingStop: PALAPYE }),
      mockRes(),
    );

    expect(created.boardingSequence).toBe(FRANCISTOWN);
    expect(created.alightingSequence).toBe(PALAPYE);
  });

  it('charges for the part travelled, not the whole ride', async () => {
    withExistingBookings([]);

    await controller.bookRide(
      request({ seatsRequested: 1, boardingStop: FRANCISTOWN, alightingStop: PALAPYE }),
      mockRes(),
    );

    // 60 for Francistown to Palapye, plus the 5% platform fee — not 150.
    expect(created.totalAmount).toBe(63);
  });

  it('charges the full fare end to end', async () => {
    withExistingBookings([]);

    await controller.bookRide(
      request({ seatsRequested: 1, boardingStop: FRANCISTOWN, alightingStop: GABORONE }),
      mockRes(),
    );

    expect(created.totalAmount).toBe(157.5);
  });

  it('sells the seat freed at Palapye to someone joining there', async () => {
    // The ride looks full — four bookings against four seats — but one
    // passenger gets out at Palapye, so this booking must succeed.
    withExistingBookings(asDescribed);
    const res = mockRes();

    await controller.bookRide(
      request({ seatsRequested: 1, boardingStop: PALAPYE, alightingStop: GABORONE }),
      res,
    );

    expect(created).toBeDefined();
    expect(created.boardingSequence).toBe(PALAPYE);
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it('refuses a Francistown boarding while the first leg is full', async () => {
    withExistingBookings(asDescribed);
    const res = mockRes();

    await controller.bookRide(
      request({ seatsRequested: 1, boardingStop: FRANCISTOWN, alightingStop: GABORONE }),
      res,
    );

    expect(created).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INSUFFICIENT_SEATS' }),
    );
  });

  it('refuses more seats than the fullest leg of the segment can hold', async () => {
    // Two free from Mahalapye, so three is one too many.
    withExistingBookings(asDescribed);
    const res = mockRes();

    await controller.bookRide(
      request({ seatsRequested: 3, boardingStop: MAHALAPYE, alightingStop: GABORONE }),
      res,
    );

    expect(created).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('refuses a drop-off that is not on the route', async () => {
    withExistingBookings([]);
    const res = mockRes();

    await controller.bookRide(
      request({ seatsRequested: 1, boardingStop: FRANCISTOWN, alightingStop: 9 }),
      res,
    );

    expect(created).toBeUndefined();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_SEGMENT' }),
    );
  });

  it('refuses travelling the route backwards', async () => {
    withExistingBookings([]);
    const res = mockRes();

    await controller.bookRide(
      request({ seatsRequested: 1, boardingStop: GABORONE, alightingStop: PALAPYE }),
      res,
    );

    expect(created).toBeUndefined();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_SEGMENT' }),
    );
  });

  it('books the whole journey when no stops are named', async () => {
    // What every existing client sends, and what an intra-city trip is.
    withExistingBookings([]);

    await controller.bookRide(request({ seatsRequested: 1 }), mockRes());

    expect(created.boardingSequence).toBe(FRANCISTOWN);
    expect(created.alightingSequence).toBe(GABORONE);
    expect(created.totalAmount).toBe(157.5);
  });
});
