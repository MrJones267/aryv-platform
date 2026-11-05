/**
 * @fileoverview The old SOS address, /api/locations/emergency-alert
 * @author Oabona-Majoko
 * @created 2026-11-05
 * @lastModified 2026-11-05
 *
 * This address had its own handler. It saved nothing, so admins never saw the
 * alert, and it sent the caller's ID and location to every connected socket.
 * It now raises the alert the same way /api/emergency/alerts does.
 */

import request from 'supertest';
import app from '../../index';
import { User } from '../../models';
import EmergencyAlert from '../../models/EmergencyAlert';
import { AuthService } from '../../services/AuthService';
import { UserRole } from '../../types';

describe('POST /api/locations/emergency-alert', () => {
  let rider: any;
  let token: string;

  beforeEach(async () => {
    rider = await User.create({
      email: 'rider@test.com', password: 'Integration-Test-Password-1!',
      firstName: 'Lesedi', lastName: 'Rider', role: UserRole.PASSENGER,
    });
    token = AuthService.generateAccessToken({ userId: rider.id, email: rider.email, role: rider.role });
  });

  it('saves the alert where operators see it, and answers like /api/emergency/alerts', async () => {
    const response = await request(app)
      .post('/api/locations/emergency-alert')
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: -24.65, longitude: 25.92, emergencyType: 'safety', message: 'Being followed' })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.emergencyNumber).toBeDefined();

    const saved = await EmergencyAlert.findAll({ where: { userId: rider.id } });
    expect(saved).toHaveLength(1);
    expect(saved[0]!.alertType).toBe('safety');
    expect(saved[0]!.status).toBe('raised');
  });

  it('still refuses an unknown emergency type', async () => {
    await request(app)
      .post('/api/locations/emergency-alert')
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: -24.65, longitude: 25.92, emergencyType: 'boredom' })
      .expect(400);
    expect(await EmergencyAlert.count()).toBe(0);
  });
});
