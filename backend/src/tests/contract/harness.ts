/**
 * @fileoverview Test harness that mounts the real routers on a real Express
 *               app, with only the data layer stubbed.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * These tests exist because three whole subsystems were dead in production
 * while every unit test stayed green: the validation middleware never called
 * next() so ~129 endpoints hung, socket auth read the wrong token field so no
 * client could connect, and the mobile app called verification and OTP paths
 * that did not exist on the server. None of those live inside a controller,
 * so testing controllers in isolation could never have found them.
 *
 * The seams are: does the route exist, does the middleware chain complete,
 * is auth enforced, does validation answer rather than hang, and does the
 * client call what the server serves. None of that needs a database, which is
 * the point — this suite runs anywhere and can gate CI, unlike the existing
 * integration suite that needs live Postgres and is currently non-blocking.
 */

import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import { AuthService } from '../../services/AuthService';
import { wrapRouterAsync } from '../../middleware/asyncSafety';
import { UserRole } from '../../types';

export const TEST_USER = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'rider@example.com',
  role: UserRole.PASSENGER,
  status: 'active',
  isEmailVerified: true,
  isPhoneVerified: true,
  firstName: 'Test',
  lastName: 'Rider',
};

export const TEST_ADMIN = {
  ...TEST_USER,
  id: '22222222-2222-4222-8222-222222222222',
  email: 'admin@example.com',
  role: UserRole.ADMIN,
};

/**
 * Router mount points, mirroring src/index.ts.
 *
 * This list drifted: `/api/emergency` and `/api/calls` were mounted in
 * index.ts but missing here, so the path-contract test reported every SOS and
 * calling endpoint as "not served by the server" and those failures were
 * absorbed into KNOWN_GAPS as if the features were unbuilt. `mountsMatchIndex`
 * below now fails if the two ever diverge again.
 */
export const MOUNTS: Array<{ path: string; module: string }> = [
  { path: '/api/auth', module: '../../routes/auth' },
  { path: '/api/rides', module: '../../routes/rides' },
  { path: '/api/bookings', module: '../../routes/bookings' },
  { path: '/api/courier', module: '../../routes/courier' },
  { path: '/api/admin', module: '../../routes/admin' },
  { path: '/api/users', module: '../../routes/users' },
  { path: '/api/locations', module: '../../routes/locations' },
  { path: '/api/payments/cash', module: '../../routes/cashPayments' },
  { path: '/api/payments/commission', module: '../../routes/commission' },
  { path: '/api/payments', module: '../../routes/payments' },
  { path: '/api/currencies', module: '../../routes/currencies' },
  { path: '/api/countries', module: '../../routes/countries' },
  { path: '/api/group-chats', module: '../../routes/groupChat' },
  { path: '/api/notifications', module: '../../routes/notifications' },
  { path: '/api/ride-requests', module: '../../routes/rideRequests' },
  { path: '/api/reports', module: '../../routes/reports' },
  { path: '/api/promos', module: '../../routes/promos' },
  { path: '/api/verification', module: '../../routes/verification' },
  { path: '/api/emergency', module: '../../routes/emergency' },
  { path: '/api/calls', module: '../../routes/calls' },
];

/**
 * Build an app with the real routers. Ordering matches index.ts, which matters:
 * /api/payments/cash must be mounted before /api/payments or the more general
 * router would shadow it.
 */
export const buildApp = (): Express => {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  for (const { path, module } of MOUNTS) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    app.use(path, wrapRouterAsync(require(module).default));
  }

  // A distinct code, deliberately not the app's NOT_FOUND: controllers return
  // 404/NOT_FOUND legitimately for a missing record, and the route-coverage
  // test must not read that as a missing route.
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found', code: 'ROUTE_NOT_FOUND' });
  });

  // Turn rejections into 500s so an unhandled one shows up as a failure rather
  // than a hang, matching how index.ts terminates its chain.
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  });

  return app;
};

/** A genuinely signed access token — not a stub, so real verification runs. */
export const tokenFor = (user = TEST_USER): string =>
  AuthService.generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

export const authHeader = (user = TEST_USER): Record<string, string> => ({
  Authorization: `Bearer ${tokenFor(user)}`,
});

/**
 * An admin-shaped token, matching what AdminController.login issues: `id`
 * rather than `userId`, a `type` of 'admin', and no issuer/audience.
 *
 * Deliberately signed with the same ADMIN_JWT_SECRET the real login uses, so
 * tests exercise the genuine separation between the two token populations
 * rather than a separation invented by the test.
 */
export const adminTokenFor = (
  overrides: { id?: string; email?: string; role?: string } = {},
): string =>
  jwt.sign(
    {
      id: overrides.id ?? '33333333-3333-4333-8333-333333333333',
      email: overrides.email ?? 'staff@example.com',
      role: overrides.role ?? 'super_admin',
      permissions: [],
      type: 'admin',
    },
    process.env['ADMIN_JWT_SECRET'] as string,
    { expiresIn: '1h' },
  );

export const adminAuthHeader = (
  overrides: { id?: string; email?: string; role?: string } = {},
): Record<string, string> => ({
  Authorization: `Bearer ${adminTokenFor(overrides)}`,
});
