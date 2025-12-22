/**
 * @fileoverview Unit tests for NotificationService
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { Server as SocketIOServer } from 'socket.io';
import { NotificationService } from '../../services/NotificationService';
import Booking from '../../models/Booking';
import Ride from '../../models/Ride';
import User from '../../models/User';
import { BookingStatus, RideStatus } from '../../types';

// Mock Socket.IO
const mockSocket = {
  id: 'socket123',
  join: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  to: jest.fn(() => ({ emit: jest.fn() })),
};

const mockIO = {
  on: jest.fn(),
  to: jest.fn(() => ({ emit: jest.fn() })),
  emit: jest.fn(),
} as any;

// Mock models
jest.mock('../../models/Booking');
jest.mock('../../models/Ride');
jest.mock('../../models/User');

describe('NotificationService', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    notificationService = new NotificationService();
    notificationService.setSocketIO(mockIO);
  });

  describe('sendToUser', () => {
    it('should send notification to specific user', async () => {
      const notification = {
        type: 'booking_update',
        title: 'Booking Confirmed',
        message: 'Your booking has been confirmed',
        timestamp: new Date().toISOString(),
      };

      await notificationService.sendToUser('user123', notification);

      expect(mockIO.to).toHaveBeenCalledWith('user_user123');
      expect(mockIO.to().emit).toHaveBeenCalledWith('notification', notification);
    });

    it('should handle missing Socket.IO gracefully', async () => {
      const serviceWithoutIO = new NotificationService();
      
      const notification = {
        type: 'test',
        title: 'Test',
        message: 'Test message',
        timestamp: new Date().toISOString(),
      };

      // Should not throw error
      await expect(serviceWithoutIO.sendToUser('user123', notification)).resolves.toBeUndefined();
    });
  });

  describe('sendToBooking', () => {
    it('should send notification to booking room', async () => {
      const notification = {
        type: 'status_change',
        title: 'Status Updated',
        message: 'Booking status changed',
        timestamp: new Date().toISOString(),
      };

      await notificationService.sendToBooking('booking123', notification);

      expect(mockIO.to).toHaveBeenCalledWith('booking_booking123');
      expect(mockIO.to().emit).toHaveBeenCalledWith('booking_notification', notification);
    });
  });

  describe('sendToRide', () => {
    it('should send notification to ride room', async () => {
      const notification = {
        type: 'ride_update',
        title: 'Ride Updated',
        message: 'Ride status changed',
        timestamp: new Date().toISOString(),
      };

      await notificationService.sendToRide('ride123', notification);

      expect(mockIO.to).toHaveBeenCalledWith('ride_ride123');
      expect(mockIO.to().emit).toHaveBeenCalledWith('ride_notification', notification);
    });
  });

  describe('notifyBookingStatusChange', () => {
    it('should notify all parties about booking confirmation', async () => {
      const mockBooking = {
        id: 'booking123',
        passengerId: 'passenger123',
        toJSON: () => ({ id: 'booking123' }),
        ride: {
          id: 'ride123',
          driverId: 'driver123',
          driver: {
            id: 'driver123',
            firstName: 'John',
            lastName: 'Driver',
          },
        },
        passenger: {
          id: 'passenger123',
          firstName: 'Jane',
          lastName: 'Passenger',
        },
      };

      (Booking.findByPk as jest.Mock).mockResolvedValue(mockBooking);

      await notificationService.notifyBookingStatusChange(
        'booking123',
        BookingStatus.CONFIRMED,
        'driver123'
      );

      expect(Booking.findByPk).toHaveBeenCalledWith('booking123', expect.any(Object));
      expect(mockIO.to).toHaveBeenCalledWith('user_passenger123');
      expect(mockIO.to).toHaveBeenCalledWith('booking_booking123');
    });

    it('should notify about booking cancellation', async () => {
      const mockBooking = {
        id: 'booking123',
        passengerId: 'passenger123',
        toJSON: () => ({ id: 'booking123' }),
        ride: {
          id: 'ride123',
          driverId: 'driver123',
          driver: {
            id: 'driver123',
            firstName: 'John',
            lastName: 'Driver',
          },
        },
        passenger: {
          id: 'passenger123',
          firstName: 'Jane',
          lastName: 'Passenger',
        },
      };

      (Booking.findByPk as jest.Mock).mockResolvedValue(mockBooking);

      await notificationService.notifyBookingStatusChange(
        'booking123',
        BookingStatus.CANCELLED,
        'passenger123'
      );

      expect(mockIO.to).toHaveBeenCalledWith('user_driver123');
      // Should send notification to driver since passenger cancelled
    });

    it('should handle booking not found', async () => {
      (Booking.findByPk as jest.Mock).mockResolvedValue(null);

      // Should not throw error
      await expect(
        notificationService.notifyBookingStatusChange('invalid-booking', BookingStatus.CONFIRMED, 'user123')
      ).resolves.toBeUndefined();

      expect(mockIO.to).not.toHaveBeenCalled();
    });

    it('should not notify the user who made the change', async () => {
      const mockBooking = {
        id: 'booking123',
        passengerId: 'passenger123',
        toJSON: () => ({ id: 'booking123' }),
        ride: {
          id: 'ride123',
          driverId: 'driver123',
          driver: {
            id: 'driver123',
            firstName: 'John',
            lastName: 'Driver',
          },
        },
        passenger: {
          id: 'passenger123',
          firstName: 'Jane',
          lastName: 'Passenger',
        },
      };

      (Booking.findByPk as jest.Mock).mockResolvedValue(mockBooking);

      await notificationService.notifyBookingStatusChange(
        'booking123',
        BookingStatus.CONFIRMED,
        'passenger123' // Passenger confirming their own booking
      );

      // Should still send to booking room but not to the passenger individually
      expect(mockIO.to).toHaveBeenCalledWith('booking_booking123');
      expect(mockIO.to).toHaveBeenCalledWith('user_driver123'); // Driver should still be notified
    });
  });

  describe('notifyRideStatusChange', () => {
    it('should notify all passengers about ride status change', async () => {
      const mockRide = {
        id: 'ride123',
        driverId: 'driver123',
        toJSON: () => ({ id: 'ride123' }),
        driver: {
          id: 'driver123',
          firstName: 'John',
          lastName: 'Driver',
        },
        vehicle: {
          make: 'Toyota',
          model: 'Camry',
          color: 'Blue',
        },
      };

      const mockBookings = [
        {
          passenger: {
            id: 'passenger1',
            firstName: 'Jane',
            lastName: 'Passenger1',
          },
        },
        {
          passenger: {
            id: 'passenger2',
            firstName: 'Bob',
            lastName: 'Passenger2',
          },
        },
      ];

      (Ride.findByPk as jest.Mock).mockResolvedValue(mockRide);
      (Booking.findAll as jest.Mock).mockResolvedValue(mockBookings);

      await notificationService.notifyRideStatusChange(
        'ride123',
        RideStatus.IN_PROGRESS,
        'driver123'
      );

      expect(Ride.findByPk).toHaveBeenCalledWith('ride123', expect.any(Object));
      expect(Booking.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ rideId: 'ride123' }),
      }));

      // Should notify both passengers
      expect(mockIO.to).toHaveBeenCalledWith('user_passenger1');
      expect(mockIO.to).toHaveBeenCalledWith('user_passenger2');
      expect(mockIO.to).toHaveBeenCalledWith('ride_ride123');
    });

    it('should handle ride not found', async () => {
      (Ride.findByPk as jest.Mock).mockResolvedValue(null);

      // Should not throw error
      await expect(
        notificationService.notifyRideStatusChange('invalid-ride', RideStatus.CONFIRMED, 'driver123')
      ).resolves.toBeUndefined();

      expect(mockIO.to).not.toHaveBeenCalled();
    });

    it('should not notify the driver who made the change', async () => {
      const mockRide = {
        id: 'ride123',
        driverId: 'driver123',
        toJSON: () => ({ id: 'ride123' }),
        driver: {
          id: 'driver123',
          firstName: 'John',
          lastName: 'Driver',
        },
      };

      const mockBookings = [
        {
          passenger: {
            id: 'driver123', // Driver is also a passenger (edge case)
            firstName: 'John',
            lastName: 'Driver',
          },
        },
      ];

      (Ride.findByPk as jest.Mock).mockResolvedValue(mockRide);
      (Booking.findAll as jest.Mock).mockResolvedValue(mockBookings);

      await notificationService.notifyRideStatusChange(
        'ride123',
        RideStatus.CONFIRMED,
        'driver123'
      );

      // Should not notify the driver individually since they made the change
      expect(mockIO.to).toHaveBeenCalledWith('ride_ride123');
      // But should not send individual notification to driver
    });
  });

  describe('notifyNewBookingRequest', () => {
    it('should notify driver about new booking request', async () => {
      const mockBooking = {
        id: 'booking123',
        toJSON: () => ({ id: 'booking123' }),
        ride: {
          driver: {
            id: 'driver123',
            firstName: 'John',
            lastName: 'Driver',
          },
        },
        passenger: {
          id: 'passenger123',
          firstName: 'Jane',
          lastName: 'Passenger',
        },
      };

      (Booking.findByPk as jest.Mock).mockResolvedValue(mockBooking);

      await notificationService.notifyNewBookingRequest('booking123');

      expect(Booking.findByPk).toHaveBeenCalledWith('booking123', expect.any(Object));
      expect(mockIO.to).toHaveBeenCalledWith('user_driver123');

      const emitCall = mockIO.to().emit.mock.calls[0];
      expect(emitCall[0]).toBe('notification');
      expect(emitCall[1].type).toBe('new_booking_request');
      expect(emitCall[1].title).toBe('New Booking Request');
      expect(emitCall[1].message).toContain('Jane Passenger wants to book your ride');
    });

    it('should handle booking not found', async () => {
      (Booking.findByPk as jest.Mock).mockResolvedValue(null);

      // Should not throw error
      await expect(
        notificationService.notifyNewBookingRequest('invalid-booking')
      ).resolves.toBeUndefined();

      expect(mockIO.to).not.toHaveBeenCalled();
    });
  });

  describe('Socket connection tracking', () => {
    it('should track connected users count', () => {
      expect(notificationService.getConnectedUsersCount()).toBe(0);
    });

    it('should check if user is connected', () => {
      expect(notificationService.isUserConnected('user123')).toBe(false);
    });

    it('should get user socket count', () => {
      expect(notificationService.getUserSocketCount('user123')).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      (Booking.findByPk as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Should not throw error
      await expect(
        notificationService.notifyBookingStatusChange('booking123', BookingStatus.CONFIRMED, 'user123')
      ).resolves.toBeUndefined();

      expect(mockIO.to).not.toHaveBeenCalled();
    });

    it('should handle Socket.IO emit errors gracefully', async () => {
      const mockIOWithError = {
        to: jest.fn(() => ({
          emit: jest.fn(() => {
            throw new Error('Socket.IO error');
          }),
        })),
      };

      notificationService.setSocketIO(mockIOWithError as any);

      const notification = {
        type: 'test',
        title: 'Test',
        message: 'Test message',
        timestamp: new Date().toISOString(),
      };

      // Should not throw error
      await expect(
        notificationService.sendToUser('user123', notification)
      ).resolves.toBeUndefined();
    });
  });

  describe('Message generation', () => {
    it('should generate appropriate messages for different booking statuses', async () => {
      const mockBooking = {
        id: 'booking123',
        passengerId: 'passenger123',
        toJSON: () => ({ id: 'booking123' }),
        ride: {
          id: 'ride123',
          driverId: 'driver123',
          driver: {
            id: 'driver123',
            firstName: 'John',
            lastName: 'Driver',
          },
        },
        passenger: {
          id: 'passenger123',
          firstName: 'Jane',
          lastName: 'Passenger',
        },
      };

      (Booking.findByPk as jest.Mock).mockResolvedValue(mockBooking);

      // Test CONFIRMED status
      await notificationService.notifyBookingStatusChange(
        'booking123',
        BookingStatus.CONFIRMED,
        'driver123'
      );

      let emitCall = mockIO.to().emit.mock.calls.find(call => 
        call[0] === 'notification' && call[1].title === 'Booking Confirmed!'
      );
      expect(emitCall[1].message).toBe('John confirmed your booking');

      // Reset mocks
      jest.clearAllMocks();
      mockIO.to = jest.fn(() => ({ emit: jest.fn() }));

      // Test COMPLETED status
      await notificationService.notifyBookingStatusChange(
        'booking123',
        BookingStatus.COMPLETED,
        'driver123'
      );

      emitCall = mockIO.to().emit.mock.calls.find(call => 
        call[0] === 'notification' && call[1].title === 'Ride Completed'
      );
      expect(emitCall[1].message).toBe('Your ride with John is completed');
    });

    it('should generate appropriate messages for ride status changes', async () => {
      const mockRide = {
        id: 'ride123',
        driverId: 'driver123',
        toJSON: () => ({ id: 'ride123' }),
        driver: {
          id: 'driver123',
          firstName: 'John',
          lastName: 'Driver',
        },
      };

      const mockBookings = [
        {
          passenger: {
            id: 'passenger1',
            firstName: 'Jane',
            lastName: 'Passenger',
          },
        },
      ];

      (Ride.findByPk as jest.Mock).mockResolvedValue(mockRide);
      (Booking.findAll as jest.Mock).mockResolvedValue(mockBookings);

      await notificationService.notifyRideStatusChange(
        'ride123',
        RideStatus.IN_PROGRESS,
        'driver123'
      );

      const emitCall = mockIO.to().emit.mock.calls.find(call => 
        call[0] === 'notification'
      );
      expect(emitCall[1].message).toBe('Your ride with John has started');
    });
  });
});