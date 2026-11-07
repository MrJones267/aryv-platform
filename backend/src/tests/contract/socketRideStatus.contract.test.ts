/**
 * @fileoverview The ride-status socket event relays the ride's saved status only.
 * @author Oabona-Majoko
 * @created 2026-11-07
 * @lastModified 2026-11-07
 *
 * 'ride_status_update' broadcast whatever status the driver's app sent to
 * everyone in the ride, so passengers could be shown "completed" or
 * "cancelled" for a ride that was neither. It now relays the status only
 * when it is the ride's saved one; changes go through the API.
 */

import { createServer, Server as HTTPServer } from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import SocketService from '../../services/SocketService';
import { AuthService } from '../../services/AuthService';
import User from '../../models/User';
import Ride from '../../models/Ride';
import { TEST_USER, tokenFor } from './harness';

const RIDE_ID = '33333333-3333-4333-8333-333333333333';

describe("socket 'ride_status_update'", () => {
  let httpServer: HTTPServer;
  let port: number;
  let service: SocketService;
  let client: ClientSocket | undefined;
  let broadcasts: Array<{ room: string; event: string; data: any }>;

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
    // The caller drives this ride, which is saved as confirmed.
    jest.spyOn(Ride, 'findOne').mockResolvedValue({ id: RIDE_ID, driverId: TEST_USER.id, status: 'confirmed' } as any);
    broadcasts = [];
    const io = (service as any).io;
    jest.spyOn(io, 'to').mockImplementation(((room: string) => ({
      emit: (event: string, data: any) => { broadcasts.push({ room, event, data }); return true; },
    })) as any);
  });

  afterEach(() => jest.restoreAllMocks());

  const connect = async (): Promise<ClientSocket> => {
    client?.close();
    client = ioClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'], auth: { token: tokenFor() }, reconnection: false, timeout: 5000,
    });
    await new Promise<void>((resolve, reject) => {
      client!.on('connect', () => resolve());
      client!.on('connect_error', reject);
    });
    return client;
  };

  const send = async (socket: ClientSocket, status: string): Promise<any[]> => {
    const errors: any[] = [];
    socket.on('error', (e: any) => errors.push(e));
    socket.emit('ride_status_update', { rideId: RIDE_ID, status });
    await new Promise<void>((resolve) => { socket.once('pong', () => resolve()); socket.emit('ping'); });
    await new Promise((resolve) => setTimeout(resolve, 200));
    return errors;
  };

  it('refuses a status that is not the ride\'s saved one, and tells nobody', async () => {
    const errors = await send(await connect(), 'completed');

    expect(errors).toEqual([expect.objectContaining({ code: 'RIDE_STATUS_MISMATCH' })]);
    expect(broadcasts.filter((b) => b.event === 'ride_status_update')).toEqual([]);
  }, 20000);

  it('relays the saved status to the ride', async () => {
    const errors = await send(await connect(), 'confirmed');

    expect(errors).toEqual([]);
    expect(broadcasts).toContainEqual(expect.objectContaining({
      room: `ride:${RIDE_ID}`, event: 'ride_status_update', data: expect.objectContaining({ status: 'confirmed' }),
    }));
  }, 20000);
});
