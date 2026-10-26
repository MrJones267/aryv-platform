/**
 * @fileoverview Unit tests for hierarchical admin role authorisation.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * AdminUser carries role ('super_admin' | 'admin' | 'moderator') and a
 * permissions array. Both were stored and put into the issued token, but the
 * only check anywhere was an equality test for 'super_admin' on three routes.
 * Everything in between — resolving courier disputes, which allocates money,
 * and editing any user, which can grant the admin role — had no role check at
 * all, so a moderator could do it.
 */

import { Response } from 'express';
import { authorizeAdminRoles } from '../../middleware/auth';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  logWarning: jest.fn(),
}));

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const reqAs = (role?: string): any => ({
  user: role ? { id: 'admin-1', role } : undefined,
  url: '/api/admin/test',
  method: 'POST',
});

describe('authorizeAdminRoles', () => {
  describe('super_admin requirement', () => {
    const guard = authorizeAdminRoles('super_admin');

    it('admits a super_admin', () => {
      const next = jest.fn();
      guard(reqAs('super_admin'), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it('refuses an admin', () => {
      const res = mockRes();
      const next = jest.fn();

      guard(reqAs('admin'), res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INSUFFICIENT_ADMIN_ROLE' }),
      );
    });

    it('refuses a moderator', () => {
      const res = mockRes();
      const next = jest.fn();

      guard(reqAs('moderator'), res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('admin requirement', () => {
    const guard = authorizeAdminRoles('admin');

    it('admits a super_admin, because roles are hierarchical', () => {
      const next = jest.fn();
      guard(reqAs('super_admin'), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it('admits an admin', () => {
      const next = jest.fn();
      guard(reqAs('admin'), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it('refuses a moderator', () => {
      // The regression that matters: a moderator could resolve courier
      // disputes, which moves money, and edit any user's role.
      const res = mockRes();
      const next = jest.fn();

      guard(reqAs('moderator'), res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('rejects anything that is not an admin identity', () => {
    const guard = authorizeAdminRoles('moderator');

    it('refuses a request with no user attached', () => {
      const res = mockRes();
      const next = jest.fn();

      guard(reqAs(), res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ADMIN_ACCESS_REQUIRED' }),
      );
    });

    it('refuses a platform user role that merely looks privileged', () => {
      // UserRole.ADMIN is a different vocabulary from AdminUser.role. A user
      // token must never satisfy an admin route guard.
      const res = mockRes();
      const next = jest.fn();

      guard(reqAs('passenger'), res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
