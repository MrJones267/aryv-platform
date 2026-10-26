/**
 * @fileoverview One account, three capabilities: the same person can offer
 *               rides, take rides, and carry parcels.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * `User.role` is a single-valued enum — passenger | driver | admin | courier —
 * which reads like an either/or. It is not one, and this suite pins that down
 * so a future change cannot quietly make it one.
 *
 * What actually gates each capability:
 *
 *   passenger  nothing beyond having an account
 *   driver     driverVerificationStatus === 'verified', from approved documents
 *   courier    CourierProfile.isCourierActive, which itself requires an
 *              approved identity document
 *
 * None of those is the role field, so a single account can hold all three at
 * once. The role is a default landing experience, not a permission.
 */

import request from 'supertest';
import type { Express } from 'express';
import { buildApp, authHeader, TEST_USER } from './harness';
import User from '../../models/User';
import DriverDocument from '../../models/DriverDocument';
import { UserRole } from '../../types';

/** Endpoints belonging to each capability, and the role they are "for". */
const CAPABILITY_ENDPOINTS = [
  { capability: 'driver', method: 'post' as const, path: '/api/rides' },
  { capability: 'driver', method: 'get' as const, path: '/api/users/vehicles' },
  { capability: 'passenger', method: 'get' as const, path: '/api/bookings' },
  { capability: 'passenger', method: 'get' as const, path: '/api/rides/search' },
  { capability: 'courier', method: 'get' as const, path: '/api/courier/deliveries' },
  { capability: 'courier', method: 'put' as const, path: '/api/courier/profile' },
  { capability: 'courier', method: 'get' as const, path: '/api/courier/packages/available' },
];

/** A refusal that means "your role is wrong", as opposed to any other outcome. */
const ROLE_REFUSAL_CODES = ['INSUFFICIENT_PERMISSIONS', 'FORBIDDEN_ROLE', 'WRONG_ROLE'];

describe('one account, several capabilities', () => {
  let app: Express;

  beforeAll(() => {
    app = buildApp();
  });

  const authenticateAs = (role: UserRole) => {
    jest.spyOn(User, 'findByPk').mockImplementation((async (pk: unknown) =>
      pk === TEST_USER.id
        ? { ...TEST_USER, role, toSafeObject: () => ({ ...TEST_USER, role }) }
        : null) as any);
  };

  describe.each([
    ['passenger', UserRole.PASSENGER],
    ['driver', UserRole.DRIVER],
    ['courier', UserRole.COURIER],
  ])('an account whose role is %s', (_label, role) => {
    it('is never refused from another capability on the grounds of its role', async () => {
      authenticateAs(role);

      const roleRefusals: string[] = [];

      for (const endpoint of CAPABILITY_ENDPOINTS) {
        const res = await request(app)
          [endpoint.method](endpoint.path)
          .set(authHeader())
          .send({});

        if (res.status === 403 && ROLE_REFUSAL_CODES.includes(res.body?.code)) {
          roleRefusals.push(
            `${endpoint.method.toUpperCase()} ${endpoint.path} (${endpoint.capability}) → ${res.body.code}`,
          );
        }
      }

      expect(roleRefusals).toEqual([]);
    }, 60000);
  });

  it('gates driving on document verification, not on the role field', async () => {
    // A user whose role says "driver" but whose documents are not approved
    // must still be refused. The gate is the verification state.
    authenticateAs(UserRole.DRIVER);

    const res = await request(app)
      .post('/api/rides')
      .set(authHeader())
      .send({
        vehicleId: '44444444-4444-4444-8444-444444444444',
        originAddress: '123 Independence Avenue, Gaborone, Botswana',
        originCoordinates: { latitude: -24.6282, longitude: 25.9231 },
        destinationAddress: '45 Nelson Mandela Drive, Francistown, Botswana',
        destinationCoordinates: { latitude: -21.17, longitude: 27.5077 },
        departureTime: new Date(Date.now() + 86400000).toISOString(),
        availableSeats: 3,
        pricePerSeat: 120,
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('DRIVER_NOT_VERIFIED');
  });

  it('gates carrying parcels on courier activation, not on the role field', async () => {
    // Same in the other direction: role 'passenger' is not what stops someone
    // becoming a courier — an unverified identity is.
    authenticateAs(UserRole.PASSENGER);
    // No approved identity document on file.
    jest.spyOn(DriverDocument, 'findOne').mockResolvedValue(null as any);

    const res = await request(app)
      .put('/api/courier/profile')
      .set(authHeader())
      .send({ isCourierActive: true });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('IDENTITY_VERIFICATION_REQUIRED');
  });

  it('lets a passenger-role account edit courier preferences that need no trust', async () => {
    authenticateAs(UserRole.PASSENGER);

    const res = await request(app)
      .put('/api/courier/profile')
      .set(authHeader())
      .send({ maxPackageWeight: 15, deliveryRadius: 20 });

    // No database here, so this reaches the handler and fails there. What
    // matters is that it was not turned away for being the wrong role.
    expect(res.status).not.toBe(403);
  });
});
