/**
 * @fileoverview Integration tests for authenticated file serving
 * @author Oabona-Majoko
 * @created 2026-04-17
 * @lastModified 2026-04-17
 *
 * Uses a minimal Express app — no DB or Redis required.
 */

import express from 'express';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { AuthService } from '../../services/AuthService';
import { UserRole } from '../../types';
import { authenticateToken } from '../../middleware/auth';

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

const TEST_DIR = './uploads/avatars';
const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const FILENAME = `${USER_ID}-9999999999.jpg`;
const FILE_PATH = path.join(TEST_DIR, FILENAME);

function tokenFor(userId: string, role = UserRole.PASSENGER) {
  return AuthService.generateAccessToken({ userId, email: `${userId}@test.com`, role });
}

// Inline the same file-serving handler from index.ts for isolated testing
const buildApp = () => {
  const app = express();
  app.use(express.json());

  app.get('/uploads/:type/:filename', authenticateToken as any, (req: any, res) => {
    const { type, filename } = req.params as { type: string; filename: string };

    const allowedTypes = ['avatars', 'documents', 'vehicles'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid file type', code: 'INVALID_FILE_TYPE' });
    }

    const safe = path.basename(filename);
    if (safe !== filename || safe.startsWith('.')) {
      return res.status(400).json({ success: false, error: 'Invalid filename', code: 'INVALID_FILENAME' });
    }

    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    if (!isAdmin && !safe.startsWith(`${req.user?.id}-`)) {
      return res.status(403).json({ success: false, error: 'Access denied', code: 'FORBIDDEN' });
    }

    const filePath = path.resolve('./uploads', type, safe);
    return res.sendFile(filePath, (err) => {
      if (err) res.status(404).json({ success: false, error: 'File not found', code: 'FILE_NOT_FOUND' });
    });
  });

  return app;
};

beforeAll(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.writeFileSync(FILE_PATH, 'fake-image-data');
});

afterAll(() => {
  try { fs.unlinkSync(FILE_PATH); } catch { /* already gone */ }
});

describe('GET /uploads/:type/:filename', () => {
  const app = buildApp();

  it('returns 401 with no token', async () => {
    const res = await request(app).get(`/uploads/avatars/${FILENAME}`);
    expect(res.status).toBe(401);
  });

  it('returns 200 for the file owner', async () => {
    const res = await request(app)
      .get(`/uploads/avatars/${FILENAME}`)
      .set('Authorization', `Bearer ${tokenFor(USER_ID)}`);
    expect(res.status).toBe(200);
  });

  it('returns 403 for a different user', async () => {
    const res = await request(app)
      .get(`/uploads/avatars/${FILENAME}`)
      .set('Authorization', `Bearer ${tokenFor(OTHER_USER_ID)}`);
    expect(res.status).toBe(403);
  });

  it('returns 400 for an unknown type directory', async () => {
    const res = await request(app)
      .get(`/uploads/secrets/${FILENAME}`)
      .set('Authorization', `Bearer ${tokenFor(USER_ID)}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for a non-existent file owned by the user', async () => {
    const res = await request(app)
      .get(`/uploads/avatars/${USER_ID}-0000000000.jpg`)
      .set('Authorization', `Bearer ${tokenFor(USER_ID)}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for dot-prefixed filenames', async () => {
    const res = await request(app)
      .get('/uploads/avatars/.hidden')
      .set('Authorization', `Bearer ${tokenFor(USER_ID)}`);
    expect(res.status).toBe(400);
  });

  it('rejects first-UUID-segment-only prefix (old broken check)', async () => {
    // Old bug: split('-')[0] gave only '550e8400', not the full UUID.
    // A file named with just the first segment should be REJECTED for the full-UUID owner.
    const firstSegment = USER_ID.split('-')[0]; // '550e8400'
    const res = await request(app)
      .get(`/uploads/avatars/${firstSegment}-fakefile.jpg`)
      .set('Authorization', `Bearer ${tokenFor(USER_ID)}`);
    expect(res.status).toBe(403);
  });
});
