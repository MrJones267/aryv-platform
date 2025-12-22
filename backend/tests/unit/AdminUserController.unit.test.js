/**
 * @fileoverview Unit tests for AdminUserController
 * @author Oabona-Majoko
 * @created 2025-01-25
 */

const { AdminUserController } = require('../../src/controllers/AdminUserController');
const User = require('../../src/models/User');
const Ride = require('../../src/models/Ride');
const Booking = require('../../src/models/Booking');
const Vehicle = require('../../src/models/Vehicle');
const { sequelize } = require('../../src/config/database');

// Mock the models
jest.mock('../../src/models/User');
jest.mock('../../src/models/Ride');
jest.mock('../../src/models/Booking');
jest.mock('../../src/models/Vehicle');
jest.mock('../../src/config/database');

describe('AdminUserController Unit Tests', () => {
  let mockReq;
  let mockRes;
  let mockTransaction;

  beforeEach(() => {
    mockReq = {
      query: {},
      params: {},
      body: {},
      user: {
        id: 'admin-123',
        email: 'admin@hitch.com',
        role: 'admin'
      }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockTransaction = {
      commit: jest.fn(),
      rollback: jest.fn()
    };

    sequelize.transaction = jest.fn().mockResolvedValue(mockTransaction);
    sequelize.fn = jest.fn();
    sequelize.col = jest.fn();
    sequelize.query = jest.fn();
    sequelize.QueryTypes = { SELECT: 'SELECT' };
  });

  describe('getAllUsers', () => {
    it('should return paginated users list', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'test1@hitch.com',
          firstName: 'Test',
          lastName: 'User1',
          role: 'passenger',
          toJSON: jest.fn().mockReturnValue({
            id: 'user-1',
            email: 'test1@hitch.com',
            firstName: 'Test',
            lastName: 'User1'
          })
        }
      ];

      User.findAndCountAll = jest.fn().mockResolvedValue({
        rows: mockUsers,
        count: 1
      });

      Ride.findAll = jest.fn().mockResolvedValue([]);
      Booking.findAll = jest.fn().mockResolvedValue([]);
      Vehicle.count = jest.fn().mockResolvedValue(0);

      mockReq.query = { page: 1, limit: 10 };

      await AdminUserController.getAllUsers(mockReq, mockRes);

      expect(User.findAndCountAll).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            users: expect.any(Array),
            pagination: expect.objectContaining({
              page: 1,
              limit: 10,
              total: 1
            })
          })
        })
      );
    });

    it('should handle filtering by role', async () => {
      mockReq.query = { role: 'driver' };

      User.findAndCountAll = jest.fn().mockResolvedValue({
        rows: [],
        count: 0
      });

      await AdminUserController.getAllUsers(mockReq, mockRes);

      expect(User.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: 'driver'
          })
        })
      );
    });

    it('should handle search functionality', async () => {
      mockReq.query = { search: 'test' };

      User.findAndCountAll = jest.fn().mockResolvedValue({
        rows: [],
        count: 0
      });

      await AdminUserController.getAllUsers(mockReq, mockRes);

      expect(User.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [expect.any(Symbol)]: expect.any(Array) // Op.or
          })
        })
      );
    });

    it('should handle errors gracefully', async () => {
      User.findAndCountAll = jest.fn().mockRejectedValue(new Error('Database error'));

      await AdminUserController.getAllUsers(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Failed to retrieve users'
        })
      );
    });
  });

  describe('getUserById', () => {
    it('should return user details with statistics', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@hitch.com',
        createdAt: new Date(),
        toJSON: jest.fn().mockReturnValue({
          id: 'user-1',
          email: 'test@hitch.com'
        })
      };

      mockReq.params.id = 'user-1';

      User.findByPk = jest.fn().mockResolvedValue(mockUser);
      Ride.findAll = jest.fn().mockResolvedValue([]);
      Booking.findAll = jest.fn().mockResolvedValue([]);
      Vehicle.findAll = jest.fn().mockResolvedValue([]);
      Ride.count = jest.fn().mockResolvedValue(0);
      Booking.count = jest.fn().mockResolvedValue(0);

      await AdminUserController.getUserById(mockReq, mockRes);

      expect(User.findByPk).toHaveBeenCalledWith('user-1', expect.any(Object));
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: expect.any(Object),
            stats: expect.any(Object)
          })
        })
      );
    });

    it('should return 404 for non-existent user', async () => {
      mockReq.params.id = 'non-existent';

      User.findByPk = jest.fn().mockResolvedValue(null);

      await AdminUserController.getUserById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'User not found'
        })
      );
    });
  });

  describe('updateUser', () => {
    it('should update user information', async () => {
      const mockUser = {
        id: 'user-1',
        update: jest.fn().mockResolvedValue(),
        toJSON: jest.fn().mockReturnValue({
          id: 'user-1',
          firstName: 'Updated'
        })
      };

      mockReq.params.id = 'user-1';
      mockReq.body = {
        firstName: 'Updated',
        lastName: 'User'
      };

      User.findByPk = jest.fn().mockResolvedValue(mockUser);

      await AdminUserController.updateUser(mockReq, mockRes);

      expect(User.findByPk).toHaveBeenCalledWith('user-1', { transaction: mockTransaction });
      expect(mockUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Updated',
          lastName: 'User'
        }),
        { transaction: mockTransaction }
      );
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should reject invalid role updates', async () => {
      const mockUser = {
        id: 'user-1',
        toJSON: jest.fn().mockReturnValue({ id: 'user-1' })
      };

      mockReq.params.id = 'user-1';
      mockReq.body = { role: 'invalid_role' };

      User.findByPk = jest.fn().mockResolvedValue(mockUser);

      await AdminUserController.updateUser(mockReq, mockRes);

      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid user role'
        })
      );
    });

    it('should filter out sensitive fields', async () => {
      const mockUser = {
        id: 'user-1',
        update: jest.fn().mockResolvedValue(),
        toJSON: jest.fn().mockReturnValue({
          id: 'user-1',
          firstName: 'Updated'
        })
      };

      mockReq.params.id = 'user-1';
      mockReq.body = {
        firstName: 'Updated',
        password: 'hacked',
        refreshToken: 'stolen',
        id: 'fake-id'
      };

      User.findByPk = jest.fn().mockResolvedValue(mockUser);

      await AdminUserController.updateUser(mockReq, mockRes);

      expect(mockUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Updated'
        }),
        { transaction: mockTransaction }
      );

      expect(mockUser.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          password: expect.anything(),
          refreshToken: expect.anything(),
          id: 'fake-id'
        }),
        expect.anything()
      );
    });
  });

  describe('blockUser', () => {
    it('should block user with reason', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@hitch.com',
        status: 'active',
        update: jest.fn().mockResolvedValue()
      };

      mockReq.params.id = 'user-1';
      mockReq.body = { reason: 'Terms violation' };

      User.findByPk = jest.fn().mockResolvedValue(mockUser);
      Ride.update = jest.fn().mockResolvedValue();
      Booking.update = jest.fn().mockResolvedValue();

      await AdminUserController.blockUser(mockReq, mockRes);

      expect(mockUser.update).toHaveBeenCalledWith(
        { status: 'suspended' },
        { transaction: mockTransaction }
      );
      expect(Ride.update).toHaveBeenCalled();
      expect(Booking.update).toHaveBeenCalled();
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should require block reason', async () => {
      mockReq.params.id = 'user-1';
      mockReq.body = {};

      await AdminUserController.blockUser(mockReq, mockRes);

      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Block reason is required'
        })
      );
    });

    it('should not block already blocked user', async () => {
      const mockUser = {
        id: 'user-1',
        status: 'suspended'
      };

      mockReq.params.id = 'user-1';
      mockReq.body = { reason: 'Test reason' };

      User.findByPk = jest.fn().mockResolvedValue(mockUser);

      await AdminUserController.blockUser(mockReq, mockRes);

      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'User is already blocked'
        })
      );
    });
  });

  describe('unblockUser', () => {
    it('should unblock suspended user', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@hitch.com',
        status: 'suspended',
        update: jest.fn().mockResolvedValue()
      };

      mockReq.params.id = 'user-1';
      mockReq.body = { reason: 'Issue resolved' };

      User.findByPk = jest.fn().mockResolvedValue(mockUser);

      await AdminUserController.unblockUser(mockReq, mockRes);

      expect(mockUser.update).toHaveBeenCalledWith(
        { status: 'active' },
        { transaction: mockTransaction }
      );
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should not unblock non-blocked user', async () => {
      const mockUser = {
        id: 'user-1',
        status: 'active'
      };

      mockReq.params.id = 'user-1';
      mockReq.body = { reason: 'Test reason' };

      User.findByPk = jest.fn().mockResolvedValue(mockUser);

      await AdminUserController.unblockUser(mockReq, mockRes);

      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'User is not blocked'
        })
      );
    });
  });

  describe('verifyUser', () => {
    it('should verify user email', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@hitch.com',
        isEmailVerified: false,
        isPhoneVerified: false,
        update: jest.fn().mockResolvedValue()
      };

      mockReq.params.id = 'user-1';
      mockReq.body = {
        verificationType: 'email',
        notes: 'Manual verification'
      };

      User.findByPk = jest.fn().mockResolvedValue(mockUser);

      await AdminUserController.verifyUser(mockReq, mockRes);

      expect(mockUser.update).toHaveBeenCalledWith(
        { isEmailVerified: true },
        { transaction: mockTransaction }
      );
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should verify both email and phone', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@hitch.com',
        isEmailVerified: false,
        isPhoneVerified: false,
        update: jest.fn().mockResolvedValue()
      };

      mockReq.params.id = 'user-1';
      mockReq.body = { verificationType: 'both' };

      User.findByPk = jest.fn().mockResolvedValue(mockUser);

      await AdminUserController.verifyUser(mockReq, mockRes);

      expect(mockUser.update).toHaveBeenCalledWith(
        {
          isEmailVerified: true,
          isPhoneVerified: true
        },
        { transaction: mockTransaction }
      );
    });
  });

  describe('getUserAnalytics', () => {
    it('should return user analytics', async () => {
      mockReq.query = {};

      User.count = jest.fn().mockResolvedValue(100);
      User.findAll = jest.fn().mockResolvedValue([
        { status: 'active', count: 80 },
        { role: 'driver', count: 30 }
      ]);
      sequelize.query = jest.fn().mockResolvedValue([
        {
          total_users: 100,
          email_verified: 70,
          phone_verified: 60,
          fully_verified: 50
        }
      ]);

      await AdminUserController.getUserAnalytics(mockReq, mockRes);

      expect(User.count).toHaveBeenCalled();
      expect(User.findAll).toHaveBeenCalledTimes(2); // For status and role
      expect(sequelize.query).toHaveBeenCalledTimes(3); // For verification, trend, and top drivers
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            summary: expect.any(Object),
            trendData: expect.any(Array),
            topDrivers: expect.any(Array)
          })
        })
      );
    });

    it('should handle date filtering', async () => {
      const startDate = '2025-01-01';
      const endDate = '2025-01-31';

      mockReq.query = { startDate, endDate };

      User.count = jest.fn().mockResolvedValue(50);
      User.findAll = jest.fn().mockResolvedValue([]);
      sequelize.query = jest.fn().mockResolvedValue([]);

      await AdminUserController.getUserAnalytics(mockReq, mockRes);

      expect(User.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.any(Object)
          })
        })
      );
    });
  });
});