/**
 * @fileoverview Unit tests for UserController
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../../types';

// --- Mocks -----------------------------------------------------------------
jest.mock('../../models/User');
jest.mock('../../models/Vehicle');
jest.mock('../../models/Ride');
jest.mock('../../models/Booking');
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
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  getErrorMessage: (e: any) => String(e?.message || e),
  getErrorStack: () => '',
  logInfo: jest.fn(),
  logError: jest.fn(),
}));
jest.mock('../../services/SMSService', () => ({
  __esModule: true,
  default: { sendVerificationCode: jest.fn(), verifyCode: jest.fn() },
}));
jest.mock('../../config/redis', () => ({
  redisClient: { connect: jest.fn(), set: jest.fn(), get: jest.fn(), del: jest.fn(), isConnected: jest.fn() },
}));

import User from '../../models/User';
import { UserController } from '../../controllers/UserController';

// ---------------------------------------------------------------------------
const mockRes = (): Response => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (user?: any, body: any = {}, params: any = {}, query: any = {}): AuthenticatedRequest =>
  ({ user, body, params, query } as any);

const controller = new UserController();

// ---------------------------------------------------------------------------
describe('UserController', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── getProfile ─────────────────────────────────────────────────────────────
  describe('getProfile', () => {
    it('returns 401 when no user on request', async () => {
      const res = mockRes();
      await controller.getProfile(mockReq(undefined), res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 404 when user not found in DB', async () => {
      (User.findByPk as jest.Mock).mockResolvedValue(null);
      const res = mockRes();
      await controller.getProfile(mockReq({ id: 'u1' }), res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'USER_NOT_FOUND' }));
    });

    it('returns 200 with user data (excluding password)', async () => {
      const fakeUser = { id: 'u1', email: 'a@b.com', firstName: 'A', vehicles: [] };
      (User.findByPk as jest.Mock).mockResolvedValue(fakeUser);
      const res = mockRes();
      await controller.getProfile(mockReq({ id: 'u1' }), res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: fakeUser }));
    });

    it('returns 500 on DB error', async () => {
      (User.findByPk as jest.Mock).mockRejectedValue(new Error('DB error'));
      const res = mockRes();
      await controller.getProfile(mockReq({ id: 'u1' }), res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'GET_PROFILE_FAILED' }));
    });
  });

  // ── updateProfile ──────────────────────────────────────────────────────────
  describe('updateProfile', () => {
    it('returns 401 when not authenticated', async () => {
      const res = mockRes();
      await controller.updateProfile(mockReq(undefined, { firstName: 'New' }), res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 404 when user not found', async () => {
      (User.findByPk as jest.Mock).mockResolvedValue(null);
      const res = mockRes();
      await controller.updateProfile(mockReq({ id: 'u1' }, { firstName: 'New' }), res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 200 after successful update', async () => {
      const fakeTx = { commit: jest.fn(), rollback: jest.fn() };
      const { sequelize } = require('../../config/database');
      sequelize.transaction.mockResolvedValue(fakeTx);

      const fakeUser = {
        id: 'u1',
        firstName: 'Old',
        update: jest.fn().mockResolvedValue(true),
        reload: jest.fn().mockResolvedValue({ id: 'u1', firstName: 'New' }),
      };
      (User.findByPk as jest.Mock).mockResolvedValue(fakeUser);

      const res = mockRes();
      await controller.updateProfile(mockReq({ id: 'u1' }, { firstName: 'New' }), res);

      expect(fakeUser.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ── getUserStatistics ──────────────────────────────────────────────────────
  describe('getUserStatistics', () => {
    it('returns 401 when not authenticated', async () => {
      const res = mockRes();
      await controller.getUserStatistics(mockReq(undefined), res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 200 with aggregated statistics', async () => {
      const Ride = require('../../models/Ride').default;
      const Booking = require('../../models/Booking').default;
      (Ride.findAll as jest.Mock).mockResolvedValue([]);
      (Booking.findAll as jest.Mock).mockResolvedValue([]);
      const res = mockRes();
      await controller.getUserStatistics(mockReq({ id: 'u1' }), res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ asDriver: {}, asPassenger: {} }),
        }),
      );
    });
  });

  // ── sendPhoneVerification ──────────────────────────────────────────────────
  describe('sendPhoneVerification', () => {
    it('returns 401 when not authenticated', async () => {
      const res = mockRes();
      await controller.sendPhoneVerification(mockReq(undefined, { phoneNumber: '+26771000000' }), res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 200 and calls smsService', async () => {
      const smsService = require('../../services/SMSService').default;
      smsService.sendVerificationCode.mockResolvedValue({ code: '123456', sent: true });

      const res = mockRes();
      await controller.sendPhoneVerification(mockReq({ id: 'u1' }, { phoneNumber: '+26771000000' }), res);

      expect(smsService.sendVerificationCode).toHaveBeenCalledWith('+26771000000');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ── confirmPhoneVerification ───────────────────────────────────────────────
  describe('confirmPhoneVerification', () => {
    it('returns 400 on invalid/expired code', async () => {
      const fakeTx = { commit: jest.fn(), rollback: jest.fn() };
      const { sequelize } = require('../../config/database');
      sequelize.transaction.mockResolvedValue(fakeTx);

      const smsService = require('../../services/SMSService').default;
      smsService.verifyCode.mockResolvedValue(false);

      const res = mockRes();
      await controller.confirmPhoneVerification(
        mockReq({ id: 'u1' }, { phoneNumber: '+26771000000', verificationCode: '999999' }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_VERIFICATION_CODE' }));
    });

    it('returns 200 and updates phone on valid code', async () => {
      const fakeTx = { commit: jest.fn(), rollback: jest.fn() };
      const { sequelize } = require('../../config/database');
      sequelize.transaction.mockResolvedValue(fakeTx);

      const smsService = require('../../services/SMSService').default;
      smsService.verifyCode.mockResolvedValue(true);
      (User.update as jest.Mock).mockResolvedValue([1]);

      const res = mockRes();
      await controller.confirmPhoneVerification(
        mockReq({ id: 'u1' }, { phoneNumber: '+26771000000', verificationCode: '123456' }),
        res,
      );

      expect(User.update).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '+26771000000' }),
        expect.objectContaining({ where: { id: 'u1' } }),
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
