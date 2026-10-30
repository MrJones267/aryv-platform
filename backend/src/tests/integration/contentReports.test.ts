/**
 * @fileoverview Integration tests for reporting chat messages and people
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * "Report message" used to thank the person and send nothing. A report now
 * reaches admins with the message as it read; only people in the chat can
 * report its messages; admins resolve it and the reporter is told.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../index';
import { User } from '../../models';
import { AdminUser } from '../../models/AdminUser';
import GroupChat, { GroupChatType } from '../../models/GroupChat';
import GroupChatParticipant from '../../models/GroupChatParticipant';
import GroupChatMessage from '../../models/GroupChatMessage';
import { AuthService } from '../../services/AuthService';
import { notificationService } from '../../services/NotificationService';
import { UserRole } from '../../types';

describe('Content reports', () => {
  let reporter: any;
  let sender: any;
  let outsider: any;
  let message: any;
  let adminToken: string;
  let sent: jest.SpyInstance;

  const token = (u: any) => AuthService.generateAccessToken({ userId: u.id, email: u.email, role: u.role });
  const report = (as: any, body: object) => request(app).post('/api/reports').set('Authorization', `Bearer ${token(as)}`).send(body);
  const admin = (method: 'get' | 'post', path: string) => request(app)[method](`/api/admin${path}`).set('Authorization', `Bearer ${adminToken}`);

  beforeEach(async () => {
    // The setup file empties every table before each test.
    sent = jest.spyOn(notificationService, 'sendToUser').mockResolvedValue(undefined);
    const mk = (email: string, firstName: string) => User.create({
      email, password: 'Integration-Test-Password-1!', firstName, lastName: 'Test', role: UserRole.PASSENGER,
    } as any);
    reporter = await mk('neo@test.com', 'Neo');
    sender = await mk('kago@test.com', 'Kago');
    outsider = await mk('tumi@test.com', 'Tumi');

    const chat = await GroupChat.create({ name: 'Gaborone to Francistown', type: GroupChatType.CUSTOM_GROUP, createdBy: sender.id } as any);
    await GroupChatParticipant.create({ groupChatId: chat.id, userId: reporter.id } as any);
    await GroupChatParticipant.create({ groupChatId: chat.id, userId: sender.id } as any);
    message = await GroupChatMessage.create({ groupChatId: chat.id, senderId: sender.id, content: 'Send me your PIN or you lose the seat' } as any);

    const a = await AdminUser.createAdmin({
      email: 'ops@test.com', password: 'Integration-Test-Password-1!', firstName: 'Ops', lastName: 'Admin', role: 'moderator', permissions: [],
    });
    adminToken = jwt.sign({ id: a.id, email: a.email, role: a.role, permissions: a.permissions, type: 'admin' }, process.env['ADMIN_JWT_SECRET']!, { expiresIn: '1h' });
  });

  afterEach(() => sent.mockRestore());

  it('files a message report against its sender, keeping what it said, once', async () => {
    const first = await report(reporter, { messageId: message.id, reason: 'scam', details: 'Asked for my PIN' }).expect(201);
    const again = await report(reporter, { messageId: message.id, reason: 'scam' }).expect(200);
    expect(again.body.data).toMatchObject({ reportId: first.body.data.reportId, duplicate: true });

    await message.update({ content: 'edited to look harmless' });
    const detail = await admin('get', `/reports/${first.body.data.reportId}`).expect(200);
    expect(detail.body.data.report).toMatchObject({
      reason: 'scam', status: 'open', details: 'Asked for my PIN',
      messageExcerpt: 'Send me your PIN or you lose the seat',
      reported: { id: sender.id }, reporter: { id: reporter.id },
      reportsAgainstUser: { total: 1, open: 1 },
    });

    const alerts = await admin('get', '/alerts').expect(200);
    expect(alerts.body.data.counts.reports).toBe(1);
  });

  it('only lets people in the chat report its messages, and nobody report themselves', async () => {
    expect((await report(outsider, { messageId: message.id, reason: 'spam' }).expect(403)).body.code).toBe('NOT_IN_CHAT');
    expect((await report(sender, { messageId: message.id, reason: 'spam' }).expect(400)).body.code).toBe('CANNOT_REPORT_SELF');
    await report(reporter, { reason: 'spam' }).expect(400);
    await report(reporter, { reportedUserId: sender.id, reason: 'not-a-reason' }).expect(400);
  });

  it('lets a person be reported directly', async () => {
    const res = await report(reporter, { reportedUserId: sender.id, reason: 'harassment', details: 'Kept calling after the ride' }).expect(201);
    const list = await admin('get', '/reports?status=open').expect(200);
    expect(list.body.data.openCount).toBe(1);
    expect(list.body.data.reports[0]).toMatchObject({ id: res.body.data.reportId, hasMessage: false, reported: { id: sender.id } });
  });

  it('is resolved by an admin with notes, once, and the reporter is told', async () => {
    const { body } = await report(reporter, { messageId: message.id, reason: 'scam' }).expect(201);
    const id = body.data.reportId;

    expect((await admin('post', `/reports/${id}/resolve`).send({ outcome: 'actioned' }).expect(400)).body.code).toBe('NOTES_REQUIRED');
    await admin('post', `/reports/${id}/resolve`).send({ outcome: 'actioned', notes: 'Suspended the account for asking for PINs' }).expect(200);
    expect((await admin('post', `/reports/${id}/resolve`).send({ outcome: 'dismissed', notes: 'Second go' }).expect(409)).body.code).toBe('ALREADY_RESOLVED');

    expect(sent).toHaveBeenCalledWith(reporter.id, expect.objectContaining({ type: 'report_reviewed', data: { reportId: id } }));
    expect(sent.mock.calls.some(c => c[0] === sender.id)).toBe(false);

    // The reporter can file again now the first one is closed.
    await report(reporter, { messageId: message.id, reason: 'scam' }).expect(201);
  });
});
