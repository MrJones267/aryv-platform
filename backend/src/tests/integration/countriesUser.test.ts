/**
 * @fileoverview A user's country, and the currency suggested for a country
 * @author Oabona-Majoko
 * @created 2026-11-05
 * @lastModified 2026-11-05
 *
 * The app called PUT/GET /api/countries/user and GET
 * /api/countries/:code/currency, and the server served none of them. GET
 * /countries/user reached /:countryCode instead, which refused "user" as a
 * country code.
 */

import request from 'supertest';
import app from '../../index';
import { User } from '../../models';
import Country from '../../models/Country';
import { Currency } from '../../models/Currency';
import { AuthService } from '../../services/AuthService';
import { UserRole } from '../../types';

describe('countries for the signed-in user', () => {
  let rider: any;
  let token: string;

  beforeEach(async () => {
    await Country.create({
      code: 'BW', name: 'Botswana', continent: 'Africa', region: 'Africa',
      phonePrefix: '+267', timezones: ['Africa/Gaborone'], languages: ['en', 'tn'],
    } as any);
    await Currency.create({ code: 'BWP', name: 'Botswana Pula', symbol: 'P' } as any);

    rider = await User.create({
      email: 'rider@test.com', password: 'Integration-Test-Password-1!',
      firstName: 'Lesedi', lastName: 'Rider', role: UserRole.PASSENGER,
    });
    token = AuthService.generateAccessToken({ userId: rider.id, email: rider.email, role: rider.role });
  });

  it('suggests the Pula for Botswana', async () => {
    const response = await request(app).get('/api/countries/bw/currency').expect(200);
    expect(response.body.data.suggestedCurrency).toMatchObject({ code: 'BWP', name: 'Botswana Pula' });
  });

  it('finds Botswana by code, from the countries table', async () => {
    const response = await request(app).get('/api/countries/BW').expect(200);
    expect(response.body.data.country).toMatchObject({ code: 'BW', dialingCode: '+267', currency: 'BWP' });
  });

  it('sets the user\'s country and makes its currency their primary one', async () => {
    const response = await request(app)
      .put('/api/countries/user')
      .set('Authorization', `Bearer ${token}`)
      .send({ countryCode: 'bw' })
      .expect(200);

    expect(response.body.data.suggestedCurrency).toBe('BWP');
    await rider.reload();
    expect(rider.countryCode).toBe('BW');
    expect(rider.timezone).toBe('Africa/Gaborone');

    const mine = await request(app).get('/api/countries/user').set('Authorization', `Bearer ${token}`).expect(200);
    expect(mine.body.data.country.code).toBe('BW');
    expect(mine.body.data.timezone).toBe('Africa/Gaborone');
  });

  it('answers 404 for a country it does not know, and 401 without sign-in', async () => {
    await request(app).put('/api/countries/user').set('Authorization', `Bearer ${token}`).send({ countryCode: 'ZZ' }).expect(404);
    await request(app).get('/api/countries/user').expect(401);
  });
});
