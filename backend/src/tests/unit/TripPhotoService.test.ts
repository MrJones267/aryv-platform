/**
 * @fileoverview Who can add and see a booking's face photos, and when they go
 * @author Oabona-Majoko
 * @created 2026-11-09
 * @lastModified 2026-11-09
 */

jest.mock('../../config/database', () => ({
  sequelize: { define: jest.fn(() => ({})) },
}));
jest.mock('../../models/Booking', () => ({ __esModule: true, default: { findByPk: jest.fn() } }));
jest.mock('../../models/Ride', () => ({ __esModule: true, default: {} }));
jest.mock('../../models/TripPhoto', () => ({
  __esModule: true,
  default: { findOne: jest.fn(), findAll: jest.fn(), create: jest.fn() },
}));
jest.mock('../../models/ContentReport', () => ({ __esModule: true, default: { count: jest.fn() } }));
jest.mock('../../models/EmergencyAlert', () => ({
  __esModule: true,
  default: { count: jest.fn() },
  EmergencyAlertStatus: { RAISED: 'raised', ACKNOWLEDGED: 'acknowledged', RESOLVED: 'resolved', FALSE_ALARM: 'false_alarm' },
}));
jest.mock('../../services/FileStorageService', () => ({
  fileStorageService: {
    store: jest.fn().mockResolvedValue({ key: 'trip-photos/new.jpg', backend: 'local' }),
    remove: jest.fn().mockResolvedValue(true),
    sendFile: jest.fn().mockResolvedValue(true),
  },
}));
jest.mock('../../utils/logger', () => ({ logInfo: jest.fn(), logWarning: jest.fn(), logError: jest.fn() }));

import { Op } from 'sequelize';
import Booking from '../../models/Booking';
import TripPhoto from '../../models/TripPhoto';
import ContentReport from '../../models/ContentReport';
import EmergencyAlert from '../../models/EmergencyAlert';
import { fileStorageService } from '../../services/FileStorageService';
import { TripPhotoService, TripPhotoError, TRIP_PHOTO_RETENTION_MS } from '../../services/TripPhotoService';
import { imageTypeOf } from '../../controllers/TripPhotoController';

const PASSENGER = 'passenger-1';
const DRIVER = 'driver-1';
const NOW = new Date('2026-11-09T12:00:00Z');

const booking = (status: string, extra: Record<string, unknown> = {}) => ({
  id: 'b1',
  rideId: 'r1',
  passengerId: PASSENGER,
  status,
  updatedAt: NOW,
  ride: { id: 'r1', driverId: DRIVER, departureTime: NOW },
  ...extra,
});

const service = new TripPhotoService();
const fakeRes = () => ({ setHeader: jest.fn() }) as any;

beforeEach(() => {
  jest.clearAllMocks();
  (ContentReport.count as jest.Mock).mockResolvedValue(0);
  (EmergencyAlert.count as jest.Mock).mockResolvedValue(0);
});

describe('save', () => {
  it('files the photo under the side the caller is on', async () => {
    (Booking.findByPk as jest.Mock).mockResolvedValue(booking('pending'));
    (TripPhoto.findOne as jest.Mock).mockResolvedValue(null);
    (TripPhoto.create as jest.Mock).mockResolvedValue({ updatedAt: NOW });

    await expect(service.save('b1', DRIVER, Buffer.from('x'), 'image/jpeg')).resolves.toMatchObject({ role: 'driver' });
    expect(TripPhoto.create).toHaveBeenCalledWith(expect.objectContaining({ role: 'driver', userId: DRIVER }));
  });

  it('refuses anyone who is not on the booking', async () => {
    (Booking.findByPk as jest.Mock).mockResolvedValue(booking('pending'));
    await expect(service.save('b1', 'stranger', Buffer.from('x'), 'image/jpeg')).rejects.toMatchObject({ status: 403 });
    expect(fileStorageService.store).not.toHaveBeenCalled();
  });

  it('refuses a booking that has ended', async () => {
    (Booking.findByPk as jest.Mock).mockResolvedValue(booking('completed'));
    await expect(service.save('b1', PASSENGER, Buffer.from('x'), 'image/jpeg')).rejects.toMatchObject({ status: 409 });
  });

  it('replaces an earlier photo and deletes its file', async () => {
    (Booking.findByPk as jest.Mock).mockResolvedValue(booking('confirmed'));
    const existing = { storageKey: 'trip-photos/old.jpg', update: jest.fn().mockResolvedValue({ updatedAt: NOW }) };
    (TripPhoto.findOne as jest.Mock).mockResolvedValue(existing);

    await service.save('b1', PASSENGER, Buffer.from('x'), 'image/jpeg');
    expect(existing.update).toHaveBeenCalledWith(expect.objectContaining({ storageKey: 'trip-photos/new.jpg' }));
    expect(fileStorageService.remove).toHaveBeenCalledWith('trip-photos/old.jpg');
  });
});

describe('who sees what', () => {
  it('shows only your own photo while the booking is pending', async () => {
    (Booking.findByPk as jest.Mock).mockResolvedValue(booking('pending'));
    (TripPhoto.findAll as jest.Mock).mockResolvedValue([]);
    await service.list('b1', DRIVER);
    expect((TripPhoto.findAll as jest.Mock).mock.calls[0][0].where.role[Op.in]).toEqual(['driver']);
  });

  it('shows both once the booking is confirmed', async () => {
    (Booking.findByPk as jest.Mock).mockResolvedValue(booking('confirmed'));
    (TripPhoto.findAll as jest.Mock).mockResolvedValue([]);
    await expect(service.list('b1', PASSENGER)).resolves.toMatchObject({ myRole: 'passenger', bookingStatus: 'confirmed' });
    expect((TripPhoto.findAll as jest.Mock).mock.calls[0][0].where.role[Op.in]).toEqual(['passenger', 'driver']);
  });

  it("does not send the other side's photo before confirmation", async () => {
    (Booking.findByPk as jest.Mock).mockResolvedValue(booking('pending'));
    await expect(service.send(fakeRes(), 'b1', 'passenger', { userId: DRIVER })).rejects.toBeInstanceOf(TripPhotoError);
    expect(fileStorageService.sendFile).not.toHaveBeenCalled();
  });

  it("sends the other side's photo once confirmed", async () => {
    (Booking.findByPk as jest.Mock).mockResolvedValue(booking('confirmed'));
    (TripPhoto.findOne as jest.Mock).mockResolvedValue({ storageKey: 'trip-photos/p.jpg' });
    await expect(service.send(fakeRes(), 'b1', 'passenger', { userId: DRIVER })).resolves.toBe(true);
    expect(fileStorageService.sendFile).toHaveBeenCalledWith(expect.anything(), 'trip-photos', 'p.jpg');
  });

  it('lets an admin see either side at any stage', async () => {
    (Booking.findByPk as jest.Mock).mockResolvedValue(booking('cancelled'));
    (TripPhoto.findOne as jest.Mock).mockResolvedValue({ storageKey: 'trip-photos/d.jpg' });
    await expect(service.send(fakeRes(), 'b1', 'driver', { asAdmin: true })).resolves.toBe(true);
  });
});

describe('sweep', () => {
  const longAgo = new Date(NOW.getTime() - TRIP_PHOTO_RETENTION_MS - 60_000);
  const photoFor = (b: ReturnType<typeof booking>) => ({ storageKey: 'trip-photos/x.jpg', booking: b, destroy: jest.fn() });

  it('deletes photos a day after the trip ended', async () => {
    const photo = photoFor(booking('completed', { updatedAt: longAgo }));
    (TripPhoto.findAll as jest.Mock).mockResolvedValue([photo]);
    await expect(service.sweep(NOW)).resolves.toBe(1);
    expect(photo.destroy).toHaveBeenCalled();
    expect(fileStorageService.remove).toHaveBeenCalledWith('trip-photos/x.jpg');
  });

  it('keeps photos of a trip that ended less than a day ago', async () => {
    const photo = photoFor(booking('completed'));
    (TripPhoto.findAll as jest.Mock).mockResolvedValue([photo]);
    await expect(service.sweep(NOW)).resolves.toBe(0);
  });

  it('deletes photos of a booking left open long after departure', async () => {
    const photo = photoFor(booking('confirmed', { ride: { id: 'r1', driverId: DRIVER, departureTime: longAgo } }));
    (TripPhoto.findAll as jest.Mock).mockResolvedValue([photo]);
    await expect(service.sweep(NOW)).resolves.toBe(1);
  });

  it('keeps photos while a report between the two is open', async () => {
    (ContentReport.count as jest.Mock).mockResolvedValue(1);
    const photo = photoFor(booking('completed', { updatedAt: longAgo }));
    (TripPhoto.findAll as jest.Mock).mockResolvedValue([photo]);
    await expect(service.sweep(NOW)).resolves.toBe(0);
    expect(photo.destroy).not.toHaveBeenCalled();
  });

  it('keeps photos while an SOS on the ride is open', async () => {
    (EmergencyAlert.count as jest.Mock).mockResolvedValue(1);
    const photo = photoFor(booking('cancelled', { updatedAt: longAgo }));
    (TripPhoto.findAll as jest.Mock).mockResolvedValue([photo]);
    await expect(service.sweep(NOW)).resolves.toBe(0);
  });

  it('keeps photos when it cannot tell whether a hold applies', async () => {
    (ContentReport.count as jest.Mock).mockRejectedValue(new Error('db down'));
    const photo = photoFor(booking('completed', { updatedAt: longAgo }));
    (TripPhoto.findAll as jest.Mock).mockResolvedValue([photo]);
    await expect(service.sweep(NOW)).resolves.toBe(0);
  });
});

describe('eraseForUser', () => {
  it('erases photos on account closure except those under a hold', async () => {
    const free = { storageKey: 'trip-photos/a.jpg', booking: booking('completed'), destroy: jest.fn() };
    const held = { storageKey: 'trip-photos/b.jpg', booking: booking('completed', { rideId: 'r-sos' }), destroy: jest.fn() };
    (TripPhoto.findAll as jest.Mock).mockResolvedValue([free, held]);
    (EmergencyAlert.count as jest.Mock).mockImplementation(async ({ where }) => (where.rideId === 'r-sos' ? 1 : 0));

    await expect(service.eraseForUser(PASSENGER)).resolves.toBe(1);
    expect(free.destroy).toHaveBeenCalled();
    expect(held.destroy).not.toHaveBeenCalled();
  });
});

describe('imageTypeOf', () => {
  it('recognises JPEG and PNG by their bytes and nothing else', () => {
    expect(imageTypeOf(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(imageTypeOf(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(imageTypeOf(Buffer.from('<svg onload=alert(1)>'))).toBeNull();
  });
});
