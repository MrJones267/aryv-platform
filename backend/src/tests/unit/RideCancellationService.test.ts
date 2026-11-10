/**
 * @fileoverview A cancelled ride takes its passengers' bookings with it
 * @author Oabona-Majoko
 * @created 2026-11-10
 * @lastModified 2026-11-10
 */

jest.mock('../../config/database', () => ({ sequelize: { define: jest.fn(() => ({})) } }));
jest.mock('../../models/Ride', () => ({ __esModule: true, default: { findAll: jest.fn(), update: jest.fn() } }));
jest.mock('../../models/Booking', () => ({ __esModule: true, default: { findAll: jest.fn(), update: jest.fn() } }));
jest.mock('../../services/NotificationService', () => ({
  notificationService: { notifyBookingStatusChange: jest.fn() },
}));
jest.mock('../../utils/logger', () => ({ logError: jest.fn() }));

import { Op } from 'sequelize';
import Ride from '../../models/Ride';
import Booking from '../../models/Booking';
import { notificationService } from '../../services/NotificationService';
import { cancelBookingsOnRides, cancelUpcomingRidesOf, notifyCancelledBookings } from '../../services/RideCancellationService';
import { BookingStatus, RideStatus } from '../../types';

const tx = {} as any;
beforeEach(() => jest.clearAllMocks());

describe('cancelBookingsOnRides', () => {
  it('cancels the pending and confirmed bookings on the rides, with the reason', async () => {
    (Booking.findAll as jest.Mock).mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);
    await expect(cancelBookingsOnRides(['r1'], 'Ride cancelled by driver', tx)).resolves.toEqual(['b1', 'b2']);

    const where = (Booking.findAll as jest.Mock).mock.calls[0][0].where;
    expect(where.status[Op.in]).toEqual([BookingStatus.PENDING, BookingStatus.CONFIRMED]);
    expect(Booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: BookingStatus.CANCELLED, cancelReason: 'Ride cancelled by driver' }),
      expect.objectContaining({ transaction: tx }),
    );
  });

  it('does nothing when no one is booked', async () => {
    (Booking.findAll as jest.Mock).mockResolvedValue([]);
    await expect(cancelBookingsOnRides(['r1'], 'x', tx)).resolves.toEqual([]);
    expect(Booking.update).not.toHaveBeenCalled();
  });
});

describe('cancelUpcomingRidesOf', () => {
  it("cancels a driver's upcoming rides and everyone booked on them", async () => {
    (Ride.findAll as jest.Mock).mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
    (Booking.findAll as jest.Mock).mockResolvedValue([{ id: 'b1' }]);
    await expect(cancelUpcomingRidesOf('driver-1', 'blocked', tx)).resolves.toEqual(['b1']);
    expect((Ride.findAll as jest.Mock).mock.calls[0][0].where.status[Op.in]).toEqual([RideStatus.PENDING, RideStatus.CONFIRMED]);
    expect(Ride.update).toHaveBeenCalledWith({ status: RideStatus.CANCELLED }, expect.anything());
  });
});

describe('notifyCancelledBookings', () => {
  it('tells every passenger, even if one notification fails', async () => {
    (notificationService.notifyBookingStatusChange as jest.Mock)
      .mockRejectedValueOnce(new Error('socket down'))
      .mockResolvedValue(undefined);
    await notifyCancelledBookings(['b1', 'b2'], 'driver-1');
    expect(notificationService.notifyBookingStatusChange).toHaveBeenCalledTimes(2);
  });
});
