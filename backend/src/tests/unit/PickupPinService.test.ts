/**
 * @fileoverview The pickup PIN: only the passenger reads it, only the driver
 *               checks it, and guessing is cut off
 * @author Oabona-Majoko
 * @created 2026-11-09
 * @lastModified 2026-11-09
 */

jest.mock('../../config/database', () => ({ sequelize: { define: jest.fn(() => ({})) } }));
jest.mock('../../models/Booking', () => ({ __esModule: true, default: { findByPk: jest.fn() } }));
jest.mock('../../models/Ride', () => ({ __esModule: true, default: {} }));
jest.mock('../../models/BookingPin', () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() },
}));

import Booking from '../../models/Booking';
import BookingPin from '../../models/BookingPin';
import { PickupPinService, MAX_PIN_ATTEMPTS } from '../../services/PickupPinService';

const PASSENGER = 'passenger-1';
const DRIVER = 'driver-1';
const booking = (status = 'confirmed') => ({ id: 'b1', passengerId: PASSENGER, status, ride: { id: 'r1', driverId: DRIVER } });
const pinRow = (extra: Record<string, unknown> = {}) => {
  const row: any = { bookingId: 'b1', pin: '4821', failedAttempts: 0, verifiedAt: null, ...extra };
  row.update = jest.fn(async (changes: Record<string, unknown>) => Object.assign(row, changes));
  return row;
};

const service = new PickupPinService();
beforeEach(() => jest.clearAllMocks());

describe('forPassenger', () => {
  it('gives the passenger a 4-digit PIN for a confirmed booking', async () => {
    (Booking.findByPk as jest.Mock).mockResolvedValue(booking());
    (BookingPin.findOrCreate as jest.Mock).mockImplementation(async ({ defaults }) => [pinRow({ pin: defaults.pin })]);
    const { pin } = await service.forPassenger('b1', PASSENGER);
    expect(pin).toMatch(/^\d{4}$/);
  });

  it('never shows the PIN to the driver', async () => {
    (Booking.findByPk as jest.Mock).mockResolvedValue(booking());
    await expect(service.forPassenger('b1', DRIVER)).rejects.toMatchObject({ status: 403 });
    expect(BookingPin.findOrCreate).not.toHaveBeenCalled();
  });

  it('has no PIN before the driver accepts', async () => {
    (Booking.findByPk as jest.Mock).mockResolvedValue(booking('pending'));
    await expect(service.forPassenger('b1', PASSENGER)).rejects.toMatchObject({ status: 409, code: 'BOOKING_NOT_CONFIRMED' });
  });
});

describe('verify', () => {
  it('accepts the right PIN from the driver and remembers it', async () => {
    (Booking.findByPk as jest.Mock).mockResolvedValue(booking());
    const row = pinRow();
    (BookingPin.findByPk as jest.Mock).mockResolvedValue(row);
    await expect(service.verify('b1', DRIVER, '4821')).resolves.toMatchObject({ verified: true });
    expect(row.verifiedAt).toBeInstanceOf(Date);
  });

  it('counts a wrong PIN and says how many tries are left', async () => {
    (Booking.findByPk as jest.Mock).mockResolvedValue(booking());
    const row = pinRow();
    (BookingPin.findByPk as jest.Mock).mockResolvedValue(row);
    await expect(service.verify('b1', DRIVER, '1111')).resolves.toEqual({ verified: false, attemptsLeft: MAX_PIN_ATTEMPTS - 1 });
    expect(row.failedAttempts).toBe(1);
  });

  it('locks after too many wrong PINs, even for the right one', async () => {
    (Booking.findByPk as jest.Mock).mockResolvedValue(booking());
    (BookingPin.findByPk as jest.Mock).mockResolvedValue(pinRow({ failedAttempts: MAX_PIN_ATTEMPTS }));
    await expect(service.verify('b1', DRIVER, '4821')).rejects.toMatchObject({ status: 423, code: 'PIN_LOCKED' });
  });

  it('only lets the ride\'s driver check', async () => {
    (Booking.findByPk as jest.Mock).mockResolvedValue(booking());
    await expect(service.verify('b1', PASSENGER, '4821')).rejects.toMatchObject({ status: 403 });
    await expect(service.verify('b1', 'someone-else', '4821')).rejects.toMatchObject({ status: 403 });
  });

  it('says so when the passenger has not opened their PIN yet', async () => {
    (Booking.findByPk as jest.Mock).mockResolvedValue(booking());
    (BookingPin.findByPk as jest.Mock).mockResolvedValue(null);
    await expect(service.verify('b1', DRIVER, '4821')).rejects.toMatchObject({ code: 'PIN_NOT_ISSUED' });
  });

  it('does not throw on a PIN of the wrong length', async () => {
    (Booking.findByPk as jest.Mock).mockResolvedValue(booking());
    (BookingPin.findByPk as jest.Mock).mockResolvedValue(pinRow());
    await expect(service.verify('b1', DRIVER, '48')).resolves.toMatchObject({ verified: false });
  });
});
