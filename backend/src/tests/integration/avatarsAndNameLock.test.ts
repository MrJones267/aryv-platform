/**
 * @fileoverview Integration tests for profile photos and ID-verified names
 * @author Oabona-Majoko
 * @created 2026-11-04
 * @lastModified 2026-11-04
 *
 * - Profile photos were behind the authenticated /uploads route. An <Image>
 *   sends no Authorization header, so every photo showed as a blank space.
 * - A name verified from an approved national ID or passport could still be
 *   edited, leaving a verified badge on a name nobody checked.
 */

import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../../index';
import { User } from '../../models';
import DriverDocument, { DocumentStatus, DocumentType } from '../../models/DriverDocument';
import { UPLOADS_DIR } from '../../middleware/upload';
import { AuthService } from '../../services/AuthService';
import { UserRole } from '../../types';

const token = (u: any) => AuthService.generateAccessToken({ userId: u.id, email: u.email, role: u.role });
const as = (u: any) => ({ Authorization: `Bearer ${token(u)}` });

const mk = (email: string, firstName: string) => User.create({
  email, password: 'Integration-Test-Password-1!', firstName, lastName: 'Molefe', role: UserRole.PASSENGER,
} as any);

describe('Profile photos', () => {
  const write = (folder: string, name: string) => {
    fs.mkdirSync(path.join(UPLOADS_DIR, folder), { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, folder, name), 'jpeg-bytes');
    return () => fs.rmSync(path.join(UPLOADS_DIR, folder, name), { force: true });
  };

  it('are served without signing in, as an <Image> requests them', async () => {
    const user = await mk('neo@test.com', 'Neo');
    const remove = write('avatars', `${user.id}-1.jpg`);
    try {
      const res = await request(app).get(`/uploads/avatars/${user.id}-1.jpg`).expect(200);
      expect(Buffer.from(res.body).toString()).toBe('jpeg-bytes');
    } finally {
      remove();
    }
  });

  it('answer not found for a photo that is not there', async () => {
    await request(app).get('/uploads/avatars/nobody-1.jpg').expect(404);
  });

  it('do not open documents to everyone', async () => {
    const user = await mk('kago@test.com', 'Kago');
    const remove = write('documents', `${user.id}-doc-1.pdf`);
    try {
      await request(app).get(`/uploads/documents/${user.id}-doc-1.pdf`).expect(401);
    } finally {
      remove();
    }
  });
});

describe('Names verified from an ID', () => {
  const verify = (user: any, documentType = DocumentType.NATIONAL_ID, status = DocumentStatus.APPROVED) =>
    DriverDocument.create({ userId: user.id, documentType, status, storageKey: 'id.jpg', mimeType: 'image/jpeg', fileSizeBytes: 9 } as any);

  it('cannot be changed once a national ID is approved', async () => {
    const user = await mk('lorato@test.com', 'Lorato');
    await verify(user);

    const res = await request(app).patch('/api/users/profile').set(as(user)).send({ firstName: 'Someone', lastName: 'Else' }).expect(403);
    expect(res.body.code).toBe('NAME_LOCKED_BY_VERIFICATION');
    await request(app).patch('/api/auth/profile').set(as(user)).send({ lastName: 'Else' }).expect(403);
    expect((await User.findByPk(user.id))!.lastName).toBe('Molefe');
  });

  it('cannot be changed once a passport is approved', async () => {
    const user = await mk('thabo@test.com', 'Thabo');
    await verify(user, DocumentType.PASSPORT);
    await request(app).patch('/api/users/profile').set(as(user)).send({ firstName: 'Tebogo' }).expect(403);
  });

  it('still lets the rest of the form save, with the name sent unchanged', async () => {
    const user = await mk('mpho@test.com', 'Mpho');
    await verify(user);
    await request(app).patch('/api/users/profile').set(as(user))
      .send({ firstName: 'Mpho ', lastName: 'Molefe', dateOfBirth: '1995-05-17' }).expect(200);
    expect(String((await User.findByPk(user.id))!.dateOfBirth)).toContain('1995');
  });

  it('can be changed while the ID is only under review', async () => {
    const user = await mk('kabelo@test.com', 'Kabelo');
    await verify(user, DocumentType.NATIONAL_ID, DocumentStatus.UNDER_REVIEW);
    await request(app).patch('/api/users/profile').set(as(user)).send({ firstName: 'Kabo' }).expect(200);
  });

  it('are reported as locked on the profile, so the app shows them read-only', async () => {
    const locked = await mk('naledi@test.com', 'Naledi');
    await verify(locked);
    const open = await mk('boitumelo@test.com', 'Boitumelo');

    expect((await request(app).get('/api/users/profile').set(as(locked)).expect(200)).body.data.nameLocked).toBe(true);
    expect((await request(app).get('/api/auth/profile').set(as(locked)).expect(200)).body.data.nameLocked).toBe(true);
    expect((await request(app).get('/api/users/profile').set(as(open)).expect(200)).body.data.nameLocked).toBe(false);
  });
});
