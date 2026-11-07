/**
 * @fileoverview Notifications reach their user over the socket, and only them.
 * @author Oabona-Majoko
 * @created 2026-11-07
 * @lastModified 2026-11-07
 *
 * Two faults in NotificationService's socket wiring:
 *   - it emitted to `user_<id>`, but SocketService joins each socket to
 *     `user:<id>`, so no notification ever arrived live;
 *   - its own 'authenticate' handler joined the room of whatever userId the
 *     client sent, unchecked, so any signed-in user could listen to anyone's
 *     notifications.
 * A real server and two real clients: the owner receives, the impostor who
 * claims the owner's id does not.
 */

import { createServer, Server as HTTPServer } from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import SocketService from '../../services/SocketService';
import { notificationService } from '../../services/NotificationService';
import { AuthService } from '../../services/AuthService';
import User from '../../models/User';
import { TEST_USER, tokenFor } from './harness';

const IMPOSTOR = { ...TEST_USER, id: '22222222-2222-4222-8222-222222222222', email: 'impostor@example.com', firstName: 'Imp' };

describe('notification rooms', () => {
  let httpServer: HTTPServer;
  let port: number;
  let service: SocketService;
  const clients: ClientSocket[] = [];

  beforeAll(async () => {
    httpServer = createServer();
    service = new SocketService(httpServer);
    notificationService.setSocketIO((service as any).io);
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as { port: number }).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    for (const client of clients) client.close();
    service.stopSessionRevalidation();
    (service as any).io?.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(() => {
    jest.spyOn(User, 'findByPk').mockImplementation((async (pk: unknown) =>
      pk === TEST_USER.id ? { ...TEST_USER } : pk === IMPOSTOR.id ? { ...IMPOSTOR } : null) as any);
    jest.spyOn(AuthService, 'isTokenBlacklisted').mockResolvedValue(false);
  });

  const connect = async (user: typeof TEST_USER): Promise<{ client: ClientSocket; received: unknown[] }> => {
    const client = ioClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      auth: { token: tokenFor(user) },
      reconnection: false,
      timeout: 5000,
    });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => resolve());
      client.on('connect_error', reject);
    });
    const received: unknown[] = [];
    client.on('notification', (payload: unknown) => received.push(payload));
    return { client, received };
  };

  /** Round-trip a ping so every event sent before it has been handled. */
  const settle = (client: ClientSocket) => new Promise<void>((resolve) => {
    client.once('pong', () => resolve());
    client.emit('ping');
  });

  it('delivers to the user it is for, and not to someone claiming their id', async () => {
    const owner = await connect(TEST_USER);
    const impostor = await connect(IMPOSTOR);

    // The old handler joined whatever room this named.
    impostor.client.emit('authenticate', { userId: TEST_USER.id, token: 'anything' });
    await settle(impostor.client);

    await notificationService.sendToUser(TEST_USER.id, {
      type: 'delivery_update',
      title: 'Package delivered',
      message: '"Laptop" has been delivered.',
      timestamp: new Date().toISOString(),
    });
    await settle(owner.client);
    await settle(impostor.client);
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(owner.received).toHaveLength(1);
    expect(impostor.received).toEqual([]);
  }, 20000);
});
