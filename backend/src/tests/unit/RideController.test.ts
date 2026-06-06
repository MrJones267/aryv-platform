/**
 * @fileoverview Unit tests for RideController
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import { Response } from 'express';
import { RideController } from '../../controllers/RideController';
import { AuthenticatedRequest } from '../../types';
import { RideStatus } from '../../types';

// Mock heavy dependencies so unit tests don't need a DB
jest.mock('../../models/Ride');
jest.mock('../../models/Booking');
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
    literal: jest.fn(),
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
jest.mock('../../services/AIService', () => ({ aiService: { predictDemand: jest.fn() } }));
jest.mock('../../services/NotificationService', () => ({ notificationService: { notifyRideUpdate: jest.fn() } }));
jest.mock('../../services/GroupChatService', () => jest.fn().mockImplementation(() => ({})));
jest.mock('../../services/SocketService', () => jest.fn());

import Ride from '../../models/Ride';

const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockRequest = (overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest => ({
  user: { id: 'user-1', email: 'test@test.com', role: 'passenger' as any },
  params: {},
  query: {},
  body: {},
  headers: {},
  ...overrides,
} as AuthenticatedRequest);

describe('RideController', () => {
  let controller: RideController;

  beforeEach(() => {
    controller = new RideController();
    jest.clearAllMocks();
    // clearAllMocks does not flush queued mockResolvedValueOnce values, which
    // otherwise leak between tests; reset the model query mocks explicitly.
    (Ride.findByPk as jest.Mock).mockReset();
    (Ride.findAll as jest.Mock).mockReset();
  });

  describe('getRideById', () => {
    it('returns 404 when ride not found', async () => {
      (Ride.findByPk as jest.Mock).mockResolvedValueOnce(null);
      const req = mockRequest({ params: { id: 'nonexistent-ride' } });
      const res = mockResponse();

      await controller.getRideById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, code: 'RIDE_NOT_FOUND' })
      );
    });

    it('returns ride data when found', async () => {
      const mockRide = {
        id: 'ride-1',
        driverId: 'driver-1',
        originAddress: 'Start',
        destinationAddress: 'End',
        status: RideStatus.PENDING,
        toJSON: () => ({ id: 'ride-1', status: RideStatus.PENDING }),
      };
      (Ride.findByPk as jest.Mock).mockResolvedValueOnce(mockRide);
      const req = mockRequest({ params: { id: 'ride-1' } });
      const res = mockResponse();

      await controller.getRideById(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('rateRide', () => {
    it('returns 401 when user is not authenticated', async () => {
      const req = mockRequest({ user: undefined as any, params: { id: 'ride-1' }, body: { rating: 5 } });
      const res = mockResponse();

      await controller.rateRide(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 400 for rating below 1', async () => {
      const req = mockRequest({ params: { id: 'ride-1' }, body: { rating: 0 } });
      const res = mockResponse();
      (Ride.findByPk as jest.Mock).mockResolvedValueOnce({ id: 'ride-1', status: RideStatus.COMPLETED });

      await controller.rateRide(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    it('returns 400 for rating above 5', async () => {
      const req = mockRequest({ params: { id: 'ride-1' }, body: { rating: 6 } });
      const res = mockResponse();
      (Ride.findByPk as jest.Mock).mockResolvedValueOnce({ id: 'ride-1', status: RideStatus.COMPLETED });

      await controller.rateRide(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateRideStatus', () => {
    it('returns 401 when unauthenticated', async () => {
      const req = mockRequest({ user: undefined as any, params: { id: 'ride-1' }, body: { status: 'cancelled' } });
      const res = mockResponse();

      await controller.updateRideStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 404 when ride not found', async () => {
      (Ride.findByPk as jest.Mock).mockResolvedValueOnce(null);
      const req = mockRequest({ params: { id: 'nonexistent' }, body: { status: 'cancelled' } });
      const res = mockResponse();

      await controller.updateRideStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 403 when non-driver tries to update', async () => {
      (Ride.findByPk as jest.Mock).mockResolvedValueOnce({
        id: 'ride-1',
        driverId: 'other-driver',
        status: RideStatus.PENDING,
      });
      const req = mockRequest({
        user: { id: 'user-1', email: 'test@test.com', role: 'passenger' } as any,
        params: { id: 'ride-1' },
        body: { status: 'cancelled' },
      });
      const res = mockResponse();

      await controller.updateRideStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('getPopularRoutes', () => {
    it('returns popular routes from completed rides', async () => {
      (Ride.findAll as jest.Mock).mockResolvedValueOnce([
        {
          originAddress: 'A',
          destinationAddress: 'B',
          originCoordinates: null,
          destinationCoordinates: null,
          dataValues: { count: '15', averagePrice: '30.00' },
          getDataValue(key: string) {
            return (this as any).dataValues[key];
          },
          toJSON: () => ({ originAddress: 'A', destinationAddress: 'B' }),
        },
      ]);

      const req = mockRequest();
      const res = mockResponse();

      await controller.getPopularRoutes(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('returns empty array when no completed rides', async () => {
      (Ride.findAll as jest.Mock).mockResolvedValueOnce([]);
      const req = mockRequest();
      const res = mockResponse();

      await controller.getPopularRoutes(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: [] })
      );
    });
  });
});
