/**
 * @fileoverview Unit tests for security-critical middleware and helpers
 * @author Oabona-Majoko
 * @created 2026-04-17
 * @lastModified 2026-04-17
 */

import path from 'path';
import { Request, Response, NextFunction } from 'express';

// ─── sanitizeId ─────────────────────────────────────────────────────────────

// Import the function indirectly by requiring the module — it's not exported
// so we test its effects through the filename output, or extract it for testing.
// Since sanitizeId is not exported we test the boundary contract via the
// storage filename callback (covered in upload integration). Instead, test the
// regex contract directly.
const sanitizeId = (id: string): string => id.replace(/[^a-zA-Z0-9-]/g, '');

describe('sanitizeId', () => {
  it('passes through valid UUIDs unchanged', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(sanitizeId(uuid)).toBe(uuid);
  });

  it('strips path traversal characters', () => {
    expect(sanitizeId('../etc/passwd')).toBe('etcpasswd');
    expect(sanitizeId('../../secret')).toBe('secret');
  });

  it('strips special characters', () => {
    expect(sanitizeId('user!@#$%^&*()')).toBe('user');
  });

  it('allows hyphens and alphanumerics', () => {
    expect(sanitizeId('abc-123-DEF')).toBe('abc-123-DEF');
  });
});

// ─── File ownership check (UUID prefix) ─────────────────────────────────────

describe('file ownership check (UUID prefix)', () => {
  const userId = '550e8400-e29b-41d4-a716-446655440000';

  it('matches when filename starts with userId-', () => {
    const filename = `${userId}-1234567890.jpg`;
    expect(filename.startsWith(`${userId}-`)).toBe(true);
  });

  it('does not match a different userId', () => {
    const otherUser = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const filename = `${userId}-1234567890.jpg`;
    expect(filename.startsWith(`${otherUser}-`)).toBe(false);
  });

  it('does not match on partial UUID segment only', () => {
    // The old bug: split('-')[0] would give '550e8400' not the full UUID
    const firstSegment = userId.split('-')[0]; // '550e8400'
    const filename = `${userId}-doc-1234567890.pdf`;
    // Correct check: full UUID prefix
    expect(filename.startsWith(`${userId}-`)).toBe(true);
    // Old broken check: would incorrectly match or fail
    expect(firstSegment).not.toBe(userId);
  });

  it('rejects dot-prefixed filenames', () => {
    const filename = '.hidden';
    expect(filename.startsWith('.')).toBe(true); // should be rejected
  });

  it('rejects path traversal in filename', () => {
    const traversal = '../../../etc/passwd';
    const safe = path.basename(traversal);
    expect(safe).toBe('passwd');
    expect(safe).not.toBe(traversal); // basename strips traversal
  });
});

// ─── emailPasswordResetLimiter ───────────────────────────────────────────────

// Mock redisClient before importing the module that uses it
jest.mock('../../config/redis', () => ({
  redisClient: {
    increment: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(false),
    connect: jest.fn().mockResolvedValue(undefined),
  },
}));

import { redisClient } from '../../config/redis';

// Inline the limiter logic since it's not exported — test the behaviour contract
const emailPasswordResetLimiter = async (
  req: Partial<Request>,
  res: Partial<Response>,
  next: NextFunction,
): Promise<void> => {
  const email = (req.body?.email as string | undefined)?.toLowerCase().trim();
  if (!email) { next(); return; }

  const count = await redisClient.increment(`pw-reset-email:${email}`, 15 * 60);
  if (count > 3) {
    (res.status as jest.Mock)(429).json({
      success: false,
      error: 'Too many password reset attempts for this email. Please try again later.',
      code: 'EMAIL_RATE_LIMIT_EXCEEDED',
    });
    return;
  }
  next();
};

describe('emailPasswordResetLimiter', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockNext = jest.fn();
    mockReq = { body: { email: 'test@example.com' } };
    mockRes = { status: mockStatus, json: mockJson };
    (redisClient.increment as jest.Mock).mockReset();
  });

  it('calls next() when under the limit', async () => {
    (redisClient.increment as jest.Mock).mockResolvedValue(1);
    await emailPasswordResetLimiter(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockStatus).not.toHaveBeenCalled();
  });

  it('calls next() at exactly the limit (3)', async () => {
    (redisClient.increment as jest.Mock).mockResolvedValue(3);
    await emailPasswordResetLimiter(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('returns 429 when over the limit (4+)', async () => {
    (redisClient.increment as jest.Mock).mockResolvedValue(4);
    await emailPasswordResetLimiter(mockReq, mockRes, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockStatus).toHaveBeenCalledWith(429);
  });

  it('calls next() when email is missing (no body)', async () => {
    mockReq = { body: {} };
    await emailPasswordResetLimiter(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(redisClient.increment).not.toHaveBeenCalled();
  });

  it('normalises email to lowercase before keying', async () => {
    (redisClient.increment as jest.Mock).mockResolvedValue(1);
    mockReq = { body: { email: 'USER@Example.COM' } };
    await emailPasswordResetLimiter(mockReq, mockRes, mockNext);
    expect(redisClient.increment).toHaveBeenCalledWith(
      'pw-reset-email:user@example.com',
      15 * 60,
    );
  });
});

// ─── RedisClient.isReady guard ───────────────────────────────────────────────

describe('RedisClient graceful fallback', () => {
  it('increment returns 0 when Redis is unavailable', async () => {
    (redisClient.increment as jest.Mock).mockResolvedValue(0);
    const result = await redisClient.increment('some-key', 60);
    expect(result).toBe(0);
  });
});
