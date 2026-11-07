/**
 * @fileoverview Creating packages under distance pricing and document rates.
 * @author Oabona-Majoko
 * @created 2026-11-07
 * @lastModified 2026-11-07
 *
 * Covers what the API now does with a package's distance and kind:
 * documents at their flat price and weight limit; offers below the floor
 * refused; only reachable tiers quoted; a true median as the suggestion.
 * And a fault found on the way: createPackage opened its transaction on its
 * first line and left it open on every early refusal, so each one kept a
 * pooled connection for good; ten of them stopped the API.
 */

import request from 'supertest';
import app from '../../index';
import { User, Package } from '../../models';
import DemandPricingEngine from '../../services/DemandPricingEngine';
import { AuthService } from '../../services/AuthService';
import { UserRole } from '../../types';

const GABORONE: [number, number] = [25.9231, -24.6282];
const MOGODITSHANE: [number, number] = [25.8656, -24.6269];
const FRANCISTOWN: [number, number] = [27.5059, -21.1661];

const body = (overrides: Record<string, unknown> = {}) => ({
  title: 'Contract',
  pickupAddress: 'Main Mall, Gaborone',
  pickupCoordinates: GABORONE,
  dropoffAddress: 'Blue Jacket Street, Francistown',
  dropoffCoordinates: FRANCISTOWN,
  packageSize: 'small',
  senderPriceOffer: 80,
  ...overrides,
});

describe('distance pricing when creating packages', () => {
  let token: string;
  const ORIGINAL_KEY = process.env['GOOGLE_MAPS_API_KEY'];
  const send = (b: Record<string, unknown>) =>
    request(app).post('/api/courier/packages').set('Authorization', `Bearer ${token}`).send(b);
  const quote = (b: Record<string, unknown>) =>
    request(app).post('/api/courier/pricing/suggestions').set('Authorization', `Bearer ${token}`).send(b);

  beforeAll(() => {
    // Distances come from the straight-line estimate, not Google, in tests.
    delete process.env['GOOGLE_MAPS_API_KEY'];
  });
  afterAll(() => { process.env['GOOGLE_MAPS_API_KEY'] = ORIGINAL_KEY; });

  beforeEach(async () => {
    // The setup file empties every table before each test.
    const sender = await User.create({
      email: 'sender@test.com', password: 'Integration-Test-Password-1!', firstName: 'Kago', lastName: 'Sender', role: UserRole.PASSENGER,
    } as any);
    token = AuthService.generateAccessToken({ userId: sender.id, email: sender.email, role: UserRole.PASSENGER });
    await DemandPricingEngine.getInstance().initializeDefaultTiers();
  });

  describe('documents', () => {
    it('sends one between towns for P80, as a small document, overnight', async () => {
      const res = await send(body({ packageType: 'document', packageSize: 'large' })).expect(201);

      expect(res.body.data.pricingSuggestions).toHaveLength(1);
      expect(res.body.data.pricingSuggestions[0]).toMatchObject({ tierType: 'economy', finalPrice: 80 });
      const stored = await Package.findByPk(res.body.data.package.id);
      expect(stored!.packageType).toBe('document');
      expect(stored!.packageSize).toBe('small');
    });

    it('costs P30 in town', async () => {
      const res = await quote({ pickupCoordinates: GABORONE, dropoffCoordinates: MOGODITSHANE, packageType: 'document' }).expect(200);
      expect(res.body.data.pricingSuggestions).toEqual([expect.objectContaining({ finalPrice: 30 })]);
    });

    it('refuses an offer below the document price', async () => {
      const res = await send(body({ packageType: 'document', senderPriceOffer: 50 }));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('OFFER_TOO_LOW');
      expect(res.body.data.minimumOffer).toBe(80);
    });

    it('refuses anything over 0.5 kg as a document', async () => {
      const res = await send(body({ packageType: 'document', weight: 2 }));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DOCUMENT_TOO_HEAVY');
    });
  });

  describe('parcels', () => {
    it('quotes only the tiers that can be met between towns', async () => {
      const res = await quote({ pickupCoordinates: GABORONE, dropoffCoordinates: FRANCISTOWN, packageSize: 'small' }).expect(200);
      const tiers = res.body.data.pricingSuggestions.map((s: { tierType: string }) => s.tierType).sort();

      expect(tiers).toEqual(['economy', 'standard']);
      expect(res.body.data.distanceSource).toBe('estimated');
      for (const s of res.body.data.pricingSuggestions) {
        expect(s.finalPrice).toBeLessThan(600);
      }
    });

    it('refuses an offer below half the cheapest suggestion, saying what is enough', async () => {
      const res = await send(body({ senderPriceOffer: 20 }));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('OFFER_TOO_LOW');
      expect(res.body.data.minimumOffer).toBeGreaterThan(20);

      await send(body({ senderPriceOffer: res.body.data.minimumOffer })).expect(201);
    });

    it('suggests the median of the tiers by price', async () => {
      const res = await send(body({ dropoffCoordinates: MOGODITSHANE, senderPriceOffer: 400 })).expect(201);
      const prices = res.body.data.pricingSuggestions.map((s: { finalPrice: number }) => s.finalPrice).sort((a: number, b: number) => a - b);
      const median = prices[Math.floor((prices.length - 1) / 2)];

      expect(Number(res.body.data.package.systemSuggestedPrice)).toBe(median);
    });
  });

  it('keeps serving after many refused packages (no leaked database connections)', async () => {
    for (let i = 0; i < 15; i += 1) {
      await send(body({ senderPriceOffer: 1 })).expect(400);
    }
    await send(body()).expect(201);
  }, 60000);
});
