/**
 * @fileoverview Integration tests for creating courier packages
 * @author Oabona-Majoko
 * @created 2026-10-27
 * @lastModified 2026-10-27
 *
 * POST /api/courier/packages answered 500 to every request. It priced through
 * DemandPricingEngine, whose updateDemandMetrics() could not succeed (it
 * queried a users column that does not exist), and the controller rethrew any
 * engine failure. In production the engine's tables did not exist either.
 * These cover the happy path, the tiers, and the property that matters most:
 * a pricing failure must not stop someone sending a package.
 */

import request from 'supertest';
import app from '../../index';
import { User } from '../../models';
import { DeliveryTier, DeliveryTierType } from '../../models/DeliveryTier';
import { DemandMetrics } from '../../models/DemandMetrics';
import DemandPricingEngine from '../../services/DemandPricingEngine';
import { AuthService } from '../../services/AuthService';
import { UserRole } from '../../types';
import logger from '../../utils/logger';

const GABORONE: [number, number] = [25.9231, -24.6282];
const MOGODITSHANE: [number, number] = [25.8656, -24.6269];

const packageBody = (overrides: Record<string, unknown> = {}) => ({
  title: 'Documents for the bank',
  description: 'A4 envelope',
  packageSize: 'small',
  pickupAddress: 'Main Mall, Gaborone',
  pickupCoordinates: GABORONE,
  dropoffAddress: 'Mogoditshane',
  dropoffCoordinates: MOGODITSHANE,
  senderPriceOffer: 45,
  ...overrides,
});

describe('Courier package creation', () => {
  let token: string;
  let loggedErrors: jest.SpyInstance;

  // createPackage answers every failure with a generic 500, and the console
  // log format drops the error's metadata. Surface it, or a failing test here
  // says nothing about why.
  const send = async (body: Record<string, unknown>) => {
    const response = await request(app)
      .post('/api/courier/packages')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    if (response.status >= 500) {
      console.error('createPackage failed:', JSON.stringify(loggedErrors.mock.calls, null, 2));
    }
    return response;
  };

  beforeEach(async () => {
    // The setup file empties every table before each test.
    const sender = await User.create({
      email: 'sender@test.com',
      password: 'Integration-Test-Password-1!',
      firstName: 'Kago',
      lastName: 'Sender',
      role: UserRole.PASSENGER,
    });
    token = AuthService.generateAccessToken({ userId: sender.id, email: sender.email, role: UserRole.PASSENGER });
    await DemandPricingEngine.getInstance().initializeDefaultTiers();
    loggedErrors = jest.spyOn(logger, 'error');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a package and returns tier-based price suggestions', async () => {
    const response = await send(packageBody());

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.package.id).toBeDefined();
    expect(response.body.data.pricingSuggestions).toHaveLength(4);
    expect(Number(response.body.data.package.systemSuggestedPrice)).toBeGreaterThan(0);
  });

  it('matches the selected suggestion to the tier the sender chose', async () => {
    const express = await DeliveryTier.findOne({ where: { tierType: DeliveryTierType.EXPRESS } });

    const response = await send(packageBody({ deliveryTierId: express!.id }));

    expect(response.status).toBe(201);
    expect(response.body.data.selectedSuggestion?.tierType).toBe(DeliveryTierType.EXPRESS);
  });

  it('still creates the package when demand pricing fails', async () => {
    const engine = DemandPricingEngine.getInstance();
    jest.spyOn(engine, 'calculatePricingSuggestions').mockRejectedValue(new Error('pricing down'));
    jest.spyOn(engine, 'updateDemandMetrics').mockRejectedValue(new Error('metrics down'));

    const response = await send(packageBody());

    expect(response.status).toBe(201);
    expect(response.body.data.package.id).toBeDefined();
    expect(response.body.data.pricingSuggestions).toEqual([]);
    expect(Number(response.body.data.package.systemSuggestedPrice)).toBeGreaterThan(0);
  });

  it('records demand metrics for the pickup area', async () => {
    // updateDemandMetrics() is the call that could never succeed. It runs
    // before the package is saved, so the row exists but does not count it.
    const response = await send(packageBody());
    expect(response.status).toBe(201);

    expect(await DemandMetrics.count()).toBe(1);
  });

  it('prices every tier for a route, in the sender\'s currency', async () => {
    const response = await request(app)
      .post('/api/courier/pricing/suggestions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        pickupCoordinates: GABORONE,
        dropoffCoordinates: MOGODITSHANE,
        packageSize: 'small',
        fragile: false,
        valuable: false,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.pricingSuggestions).toHaveLength(4);
    // A sender with no currency preference prices in the platform currency.
    expect(response.body.data.currency).toBe('BWP');
  });

  it('lists the four default delivery tiers', async () => {
    const response = await request(app)
      .get('/api/courier/delivery-tiers')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.map((t: { tierType: string }) => t.tierType).sort()).toEqual(
      ['economy', 'express', 'lightning', 'standard']
    );
  });
});
