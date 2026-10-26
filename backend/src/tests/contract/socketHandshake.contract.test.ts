/**
 * @fileoverview End-to-end socket handshake: a real socket.io server and a
 *               real client, over a real port.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * The unit tests for authenticateSocketToken call the function directly. This
 * exercises the path a client actually takes — handshake auth, the middleware
 * wiring, the error surfaced to the client — which is where the defect lived:
 * the middleware read the wrong token field, so no client could ever connect
 * and every real-time feature was dead.
 */

import { createServer, Server as HTTPServer } from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import SocketService from '../../services/SocketService';
import { AuthService } from '../../services/AuthService';
import User from '../../models/User';
import { TEST_USER, tokenFor } from './harness';

describe('socket handshake', () => {
  let httpServer: HTTPServer;
  let port: number;
  let service: SocketService;
  const clients: ClientSocket[] = [];

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
    for (const client of clients) client.close();
    (service as any).io?.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(() => {
    // Faithful to Sequelize: findByPk(undefined) short-circuits to null. A
    // mock returning a user for any argument would let the original
    // wrong-field bug connect successfully here.
    jest.spyOn(User, 'findByPk').mockImplementation((async (pk: unknown) =>
      pk === TEST_USER.id ? { ...TEST_USER } : null) as any);
    jest.spyOn(AuthService, 'isTokenBlacklisted').mockResolvedValue(false);
  });

  /** Resolve with 'connected', or with the server's refusal message. */
  const attempt = (auth?: Record<string, unknown>): Promise<string> =>
    new Promise((resolve) => {
      const client = ioClient(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
        ...(auth ? { auth } : {}),
        reconnection: false,
        timeout: 5000,
      });
      clients.push(client);

      // Cleared on settle, or the pending handles keep the runner alive.
      const guard = setTimeout(() => resolve('no response'), 8000);
      const settle = (value: string) => {
        clearTimeout(guard);
        resolve(value);
      };

      client.on('connect', () => settle('connected'));
      client.on('connect_error', (error: Error) => settle(error.message));
    });

  it('accepts a client presenting a valid token', async () => {
    await expect(attempt({ token: tokenFor() })).resolves.toBe('connected');
  }, 20000);

  it('refuses a client with no token', async () => {
    await expect(attempt()).resolves.toBe('Authentication token required');
  }, 20000);

  it('refuses a token signed with the wrong secret', async () => {
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign({ userId: TEST_USER.id }, 'not-the-real-secret');

    await expect(attempt({ token: forged })).resolves.toBe('Authentication failed');
  }, 20000);

  it('refuses a token invalidated at logout', async () => {
    jest.spyOn(AuthService, 'isTokenBlacklisted').mockResolvedValue(true);

    await expect(attempt({ token: tokenFor() })).resolves.toBe(
      'Token has been invalidated',
    );
  }, 20000);

  it('refuses a suspended account', async () => {
    jest.spyOn(User, 'findByPk').mockImplementation((async () => ({
      ...TEST_USER,
      status: 'suspended',
    })) as any);

    await expect(attempt({ token: tokenFor() })).resolves.toBe(
      'Account is suspended or deactivated',
    );
  }, 20000);
});
