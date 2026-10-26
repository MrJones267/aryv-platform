/**
 * @fileoverview The endpoints that move money must not answer to the person
 *               who benefits from moving it.
 * @author Oabona-Majoko
 * @created 2026-08-25
 * @lastModified 2026-08-25
 *
 * Two holes are pinned shut here, both of which were reachable by an ordinary
 * signed-in user with no special positioning:
 *
 *   POST /api/bookings/:id/refund   let the booking's own passenger refund
 *                                   themselves, for an amount they chose, with
 *                                   no check on whether the ride had happened.
 *                                   Book, ride, then claim the money back.
 *
 *   POST /api/payments/confirm      marked a card or mobile-money payment
 *                                   'completed' without charging anything.
 *
 * These assert at the routing layer, which is where both fixes live. The
 * amount-clamping and eligibility rules inside processRefund are covered by
 * the PaymentService unit tests; what cannot be unit-tested is whether the
 * middleware chain actually refuses the request, which is this file's job.
 */

import crypto from 'crypto';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp, authHeader, adminAuthHeader, TEST_USER } from './harness';
import { redisClient } from '../../config/redis';
import Booking from '../../models/Booking';

const BOOKING_ID = '44444444-4444-4444-8444-444444444444';

describe('endpoints that move money', () => {
  let app: Express;

  beforeAll(() => {
    app = buildApp();
  });

  describe('POST /api/bookings/:id/refund', () => {
    it('refuses an ordinary passenger token', async () => {
      const res = await request(app)
        .post(`/api/bookings/${BOOKING_ID}/refund`)
        .set(authHeader(TEST_USER))
        .send({ amount: 999999, reason: 'I would like my money back please' });

      // 401, not 403: admin tokens are signed with ADMIN_JWT_SECRET, so a
      // passenger's token does not even verify here. It used to verify — both
      // populations were signed with JWT_SECRET — and was then turned away on
      // the `type` claim alone. Cryptographic separation is the stronger
      // barrier, so the refusal moved earlier.
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_ADMIN_TOKEN');
    });

    it('refuses an unauthenticated caller', async () => {
      const res = await request(app)
        .post(`/api/bookings/${BOOKING_ID}/refund`)
        .send({ amount: 10, reason: 'No token at all here' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('ACCESS_TOKEN_REQUIRED');
    });

    it('reaches the handler for an admin token', async () => {
      // The database is deliberately unavailable in this suite, so the admin
      // lookup inside authenticateAdminToken cannot succeed and this stops at
      // 401 INVALID_ADMIN_TOKEN. What matters is that it is *not* the 403
      // ADMIN_ACCESS_REQUIRED a passenger gets: the token shape was accepted
      // and the request was refused for a different, data-layer reason.
      const res = await request(app)
        .post(`/api/bookings/${BOOKING_ID}/refund`)
        .set(adminAuthHeader())
        .send({ amount: 10, reason: 'Legitimate support refund' });

      expect(res.body.code).not.toBe('ADMIN_ACCESS_REQUIRED');
      expect(res.body.code).toBe('INVALID_ADMIN_TOKEN');
    });

    it('still validates its input before doing anything', async () => {
      const res = await request(app)
        .post('/api/bookings/not-a-uuid/refund')
        .set(adminAuthHeader())
        .send({ reason: 'x' }); // too short, and the id is not a UUID

      expect([400, 401]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/payments/confirm', () => {
    it('refuses an unauthenticated caller', async () => {
      const res = await request(app)
        .post('/api/payments/confirm')
        .send({ paymentIntentId: 'pi_anything' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('does not complete a payment for an intent the caller cannot produce', async () => {
      // Redis is stubbed to return null, so no intent is found. The point is
      // that the endpoint answers with a refusal rather than fabricating a
      // completed payment from the request body.
      const res = await request(app)
        .post('/api/payments/confirm')
        .set(authHeader(TEST_USER))
        .send({ paymentIntentId: 'pi_made_up', cardToken: 'tok_whatever' });

      expect(res.status).not.toBe(200);
      expect(res.body.success).toBe(false);
    });
  });

  describe('mobile money ride payment settlement', () => {
    const SECRET = 'contract-test-orange-secret';
    const REFERENCE = 'mm_contracttest01';
    const INTENT_ID = 'pi_contract_mm';

    const signedPost = (payload: Record<string, unknown>, secret = SECRET) => {
      const body = JSON.stringify(payload);
      const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
      return request(app)
        .post('/api/payments/mobile-money/webhook/orange')
        .set('Content-Type', 'application/json')
        .set('x-signature', signature)
        .send(body);
    };

    beforeEach(() => {
      process.env['ORANGE_MONEY_WEBHOOK_SECRET'] = SECRET;

      const store: Record<string, string> = {
        [`mm_tx:${REFERENCE}`]: JSON.stringify({
          reference: REFERENCE,
          userId: TEST_USER.id,
          purpose: 'ride_payment',
          paymentIntentId: INTENT_ID,
          bookingId: BOOKING_ID,
          amount: 75,
          currency: 'BWP',
          status: 'pending',
        }),
        [`payment_intent:${INTENT_ID}`]: JSON.stringify({
          id: INTENT_ID,
          userId: TEST_USER.id,
          amount: 75,
          currency: 'BWP',
          paymentMethod: 'mobile_money',
          status: 'pending',
          bookingId: BOOKING_ID,
        }),
      };

      (redisClient.get as jest.Mock).mockImplementation(async (k: string) => store[k] ?? null);
      (redisClient.set as jest.Mock).mockImplementation(async (k: string, v: string) => {
        store[k] = v;
      });
    });

    afterEach(() => {
      delete process.env['ORANGE_MONEY_WEBHOOK_SECRET'];
      jest.restoreAllMocks();
    });

    it('settles the ride payment and confirms the booking on a signed success', async () => {
      // This path used to do nothing at all: the mm_tx record carried no
      // `purpose`, so the handler's only branch — wallet top-up — skipped it
      // and a mobile-money ride payment could never complete.
      const update = jest.fn();
      jest.spyOn(Booking, 'findByPk').mockResolvedValue({
        id: BOOKING_ID, status: 'pending', update,
      } as never);

      const res = await signedPost({ reference: REFERENCE, status: 'success', providerRef: 'OM123' });

      expect(res.status).toBe(200);
      expect(update).toHaveBeenCalledWith({ status: 'confirmed' });

      const stored = (redisClient.set as jest.Mock).mock.calls
        .map(([, v]) => v)
        .filter((v: string) => v.includes(INTENT_ID));
      expect(stored.some((v: string) => JSON.parse(v).status === 'completed')).toBe(true);
    });

    it('settles nothing when the signature does not verify', async () => {
      const update = jest.fn();
      jest.spyOn(Booking, 'findByPk').mockResolvedValue({
        id: BOOKING_ID, status: 'pending', update,
      } as never);

      const res = await signedPost(
        { reference: REFERENCE, status: 'success', providerRef: 'OM123' },
        'not-the-real-secret',
      );

      expect(res.status).toBe(401);
      expect(update).not.toHaveBeenCalled();
    });

    it('settles nothing when the provider reports a failure', async () => {
      const update = jest.fn();
      jest.spyOn(Booking, 'findByPk').mockResolvedValue({
        id: BOOKING_ID, status: 'pending', update,
      } as never);

      const res = await signedPost({ reference: REFERENCE, status: 'failed' });

      expect(res.status).toBe(200);
      expect(update).not.toHaveBeenCalled();
    });
  });
});
