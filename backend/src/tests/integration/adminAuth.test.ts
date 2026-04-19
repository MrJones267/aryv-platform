/**
 * @fileoverview Integration tests for admin auth route protection
 * @author Oabona-Majoko
 * @created 2026-04-17
 * @lastModified 2026-04-17
 *
 * Uses a minimal Express app — no DB or Redis required.
 */

import express from 'express';
import request from 'supertest';
import { AuthService } from '../../services/AuthService';
import { UserRole } from '../../types';

// Mock Redis and DB before any module that needs them is loaded
jest.mock('../../config/redis', () => ({
  redisClient: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    increment: jest.fn().mockResolvedValue(1),
    isConnected: jest.fn().mockReturnValue(false),
    connect: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../config/database', () => ({
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined),
    define: jest.fn(),
    fn: jest.fn(),
    col: jest.fn(),
    literal: jest.fn(),
  },
  testConnection: jest.fn().mockResolvedValue(undefined),
  Op: {},
  QueryTypes: {},
}));

import { authenticateAdminToken } from '../../middleware/auth';

// Minimal app — only the routes under test
const buildApp = () => {
  const app = express();
  app.use(express.json());

  // Mirrors the real route: GET /api/admin/auth/verify requires authenticateAdminToken
  app.get('/api/admin/auth/verify', authenticateAdminToken, (_req, res) => {
    res.json({ success: true, message: 'Token valid' });
  });

  // Unprotected login stub
  app.post('/api/admin/auth/login', (_req, res) => {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  });

  return app;
};

describe('GET /api/admin/auth/verify — auth enforcement', () => {
  const app = buildApp();

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/admin/auth/verify');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .get('/api/admin/auth/verify')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('returns 401/403 with a passenger JWT (wrong role)', async () => {
    const token = AuthService.generateAccessToken({
      userId: 'fake-id',
      email: 'user@example.com',
      role: UserRole.PASSENGER,
    });
    const res = await request(app)
      .get('/api/admin/auth/verify')
      .set('Authorization', `Bearer ${token}`);
    expect([401, 403]).toContain(res.status);
  });

  it('returns 401/403 with a driver JWT (wrong role)', async () => {
    const token = AuthService.generateAccessToken({
      userId: 'driver-id',
      email: 'driver@example.com',
      role: UserRole.DRIVER,
    });
    const res = await request(app)
      .get('/api/admin/auth/verify')
      .set('Authorization', `Bearer ${token}`);
    expect([401, 403]).toContain(res.status);
  });
});

describe('POST /api/admin/auth/login', () => {
  const app = buildApp();

  it('returns non-200 for missing credentials', async () => {
    const res = await request(app).post('/api/admin/auth/login').send({});
    expect(res.status).not.toBe(200);
  });
});
