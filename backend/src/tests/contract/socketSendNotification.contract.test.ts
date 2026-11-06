/**
 * @fileoverview No client can push a notification to another user's phone.
 * @author Oabona-Majoko
 * @created 2026-11-06
 * @lastModified 2026-11-06
 *
 * The server used to handle a 'send_notification' event by forwarding the
 * sender's title and message to `user:<to>` for any `to`. Any signed-in user
 * could therefore put a fake "ARYV Support: send us your code" notice in
 * anyone's notification list. The handler is gone; this sends the event at
 * the sender's own room (so a surviving handler would deliver it straight
 * back) and checks nothing arrives.
 */

import { createServer, Server as HTTPServer } from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import SocketService from '../../services/SocketService';
import { AuthService } from '../../services/AuthService';
import User from '../../models/User';
import { TEST_USER, tokenFor } from './harness';

describe("socket 'send_notification'", () => {
  let httpServer: HTTPServer;
  let port: number;
  let service: SocketService;
  let client: ClientSocket | undefined;

  beforeAll(async () => {
    httpServer = createServer();
    service = new SocketService(httpServer);
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as { port: number }).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    client?.close();
    service.stopSessionRevalidation();
    (service as any).io?.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(() => {
    jest.spyOn(User, 'findByPk').mockImplementation((async (pk: unknown) =>
      pk === TEST_USER.id ? { ...TEST_USER } : null) as any);
    jest.spyOn(AuthService, 'isTokenBlacklisted').mockResolvedValue(false);
  });

  it('is not relayed to the target user', async () => {
    client = ioClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      auth: { token: tokenFor() },
      reconnection: false,
      timeout: 5000,
    });
    await new Promise<void>((resolve, reject) => {
      client!.on('connect', () => resolve());
      client!.on('connect_error', reject);
    });

    const received: unknown[] = [];
    client.on('notification', (payload: unknown) => received.push(payload));

    client.emit('send_notification', {
      to: TEST_USER.id,
      type: 'system',
      title: 'ARYV Support',
      message: 'Reply with the code we just sent you',
    });

    // The server handles a client's events in order, so once 'pong' is back
    // the event above has been dealt with; the pause covers the room emit.
    await new Promise<void>((resolve) => {
      client!.once('pong', () => resolve());
      client!.emit('ping');
    });
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(received).toEqual([]);
  }, 20000);
});
