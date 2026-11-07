/**
 * @fileoverview The app's Google calls, made by the server with its own key.
 * @author Oabona-Majoko
 * @created 2026-11-07
 * @lastModified 2026-11-07
 *
 * The app called Google's web services with a key shipped in the APK, which
 * could not be restricted to the app. GET /api/locations/google/:service now
 * makes those calls with the server's key. These pin what that route may do:
 * only signed-in callers, only four services, only their listed parameters,
 * cheap place-detail fields only, and Google's reply passed back unchanged.
 */

import request from 'supertest';
import axios from 'axios';
import type { Express } from 'express';
import { buildApp, authHeader, TEST_USER } from './harness';
import User from '../../models/User';

describe('GET /api/locations/google/:service', () => {
  let app: Express;
  let get: jest.SpyInstance;
  const ORIGINAL_KEY = process.env['GOOGLE_MAPS_API_KEY'];

  beforeAll(() => {
    process.env['GOOGLE_MAPS_API_KEY'] = 'server-key-for-tests';
    app = buildApp();
  });

  afterAll(() => {
    process.env['GOOGLE_MAPS_API_KEY'] = ORIGINAL_KEY;
  });

  beforeEach(() => {
    jest.spyOn(User, 'findByPk').mockImplementation((async (pk: unknown) =>
      pk === TEST_USER.id ? { ...TEST_USER, toSafeObject: () => ({ ...TEST_USER }) } : null) as any);
    get = jest.spyOn(axios, 'get').mockResolvedValue({
      data: { status: 'OK', results: [{ formatted_address: 'Main Mall, Gaborone, Botswana' }] },
    } as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it('refuses a caller who is not signed in, without calling Google', async () => {
    const res = await request(app).get('/api/locations/google/geocode?latlng=-24.65,25.91');

    expect(res.status).toBe(401);
    expect(get).not.toHaveBeenCalled();
  });

  it("returns Google's reply unchanged, fetched with the server's key", async () => {
    const res = await request(app)
      .get('/api/locations/google/geocode?latlng=-24.6545,25.9087&language=en')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'OK', results: [{ formatted_address: 'Main Mall, Gaborone, Botswana' }] });
    expect(get).toHaveBeenCalledWith(
      'https://maps.googleapis.com/maps/api/geocode/json',
      expect.objectContaining({ params: { latlng: '-24.6545,25.9087', language: 'en', key: 'server-key-for-tests' } }),
    );
  });

  it('forwards only the parameters listed for the service', async () => {
    await request(app)
      .get('/api/locations/google/autocomplete?input=Game%20City&components=country:bw&key=someone-elses-key&output=xml')
      .set(authHeader());

    const sent = get.mock.calls[0][1].params;
    expect(sent).toEqual({ input: 'Game City', components: 'country:bw', key: 'server-key-for-tests' });
  });

  it('asks Google only for the cheap place-detail fields', async () => {
    await request(app)
      .get('/api/locations/google/details?place_id=abc&fields=geometry,name,formatted_address,reviews,opening_hours')
      .set(authHeader());

    expect(get.mock.calls[0][1].params.fields).toBe('geometry,name,formatted_address');
  });

  it('refuses a service it does not offer', async () => {
    const res = await request(app).get('/api/locations/google/timezone?location=1,2').set(authHeader());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('UNKNOWN_MAP_SERVICE');
    expect(get).not.toHaveBeenCalled();
  });

  it('refuses a call missing what Google needs, without calling Google', async () => {
    const res = await request(app).get('/api/locations/google/directions?origin=-24.65,25.91').set(authHeader());

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MAP_PARAMS_MISSING');
    expect(get).not.toHaveBeenCalled();
  });

  it('answers with a Google-shaped error when Google cannot be reached', async () => {
    get.mockRejectedValueOnce(new Error('socket hang up'));

    const res = await request(app)
      .get('/api/locations/google/directions?origin=-24.65,25.91&destination=-24.62,25.94')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('UNKNOWN_ERROR');
  });
});
