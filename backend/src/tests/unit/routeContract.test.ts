/**
 * @fileoverview Contract test across every registered route: no middleware may
 *               silently swallow a request.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * Why this exists: validateInput was an alias for a Joi-schema *factory*. Used
 * bare in a route it neither responded nor called next(), so ~129 endpoints
 * hung until the client timed out. Every controller unit test still passed,
 * because they call controllers directly and never traverse the router.
 *
 * This walks each router's real stack and invokes every non-terminal handler,
 * asserting it either continues the chain or answers the request. It does not
 * touch the database: only middleware positions are exercised, never the final
 * controller.
 */

import type { Router, Request, Response, NextFunction } from 'express';

jest.mock('../../config/redis', () => ({
  redisClient: {
    connect: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    // rate-limit-redis does SCRIPT LOAD (expects a sha string) then EVALSHA
    // (expects [hits, ttl]). Returning a bare number makes it throw on init.
    sendCommand: jest.fn(async (args: string[]) => {
      const command = (args?.[0] ?? '').toUpperCase();
      if (command === 'SCRIPT') return 'a'.repeat(40);
      if (command === 'EVALSHA' || command === 'EVAL') return [1, 60000];
      return 1;
    }),
    isConnected: jest.fn().mockReturnValue(true),
  },
}));

/** Every router mounted in src/index.ts. */
const loadRouters = (): Array<{ name: string; router: Router }> => [
  { name: 'auth', router: require('../../routes/auth').default },
  { name: 'rides', router: require('../../routes/rides').default },
  { name: 'bookings', router: require('../../routes/bookings').default },
  { name: 'courier', router: require('../../routes/courier').default },
  { name: 'users', router: require('../../routes/users').default },
  { name: 'locations', router: require('../../routes/locations').default },
  { name: 'cashPayments', router: require('../../routes/cashPayments').default },
  { name: 'commission', router: require('../../routes/commission').default },
  { name: 'currencies', router: require('../../routes/currencies').default },
  { name: 'countries', router: require('../../routes/countries').default },
  { name: 'notifications', router: require('../../routes/notifications').default },
  { name: 'payments', router: require('../../routes/payments').default },
  { name: 'rideRequests', router: require('../../routes/rideRequests').default },
  { name: 'promos', router: require('../../routes/promos').default },
  { name: 'verification', router: require('../../routes/verification').default },
  { name: 'groupChat', router: require('../../routes/groupChat').default },
];

interface RouteHandler {
  routerName: string;
  method: string;
  path: string;
  index: number;
  total: number;
  handle: (req: Request, res: Response, next: NextFunction) => unknown;
}

/** Flatten every router into its individual route handlers. */
const collectHandlers = (): RouteHandler[] => {
  const handlers: RouteHandler[] = [];

  for (const { name, router } of loadRouters()) {
    const stack = (router as unknown as { stack: any[] }).stack ?? [];

    for (const layer of stack) {
      if (!layer.route) continue;

      const path: string = layer.route.path;
      const method: string =
        Object.keys(layer.route.methods)[0]?.toUpperCase() ?? 'GET';
      const routeStack: any[] = layer.route.stack ?? [];

      routeStack.forEach((entry, index) => {
        handlers.push({
          routerName: name,
          method,
          path,
          index,
          total: routeStack.length,
          handle: entry.handle,
        });
      });
    }
  }

  return handlers;
};

const makeReq = (): any => {
  const req: any = {
    method: 'POST',
    url: '/',
    originalUrl: '/',
    baseUrl: '',
    path: '/',
    ip: '127.0.0.1',
    ips: [],
    body: {},
    params: {},
    query: {},
    cookies: {},
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    app: { get: () => undefined },
    get(header: string) {
      return this.headers[header.toLowerCase()];
    },
    header(h: string) {
      return this.get(h);
    },
    accepts: () => false,
    is: () => false,
  };
  return req;
};

const makeRes = (onResponse: () => void): any => {
  const res: any = {
    headersSent: false,
    locals: {},
    statusCode: 200,
    setHeader: () => res,
    getHeader: () => undefined,
    removeHeader: () => res,
    set: () => res,
    header: () => res,
    vary: () => res,
    append: () => res,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    type: () => res,
    json: () => {
      res.headersSent = true;
      onResponse();
      return res;
    },
    send: () => {
      res.headersSent = true;
      onResponse();
      return res;
    },
    end: () => {
      res.headersSent = true;
      onResponse();
      return res;
    },
    sendFile: () => {
      res.headersSent = true;
      onResponse();
      return res;
    },
    on: () => res,
    once: () => res,
    emit: () => false,
    removeListener: () => res,
  };
  return res;
};

/**
 * Invoke one handler and resolve with what it did: continued the chain,
 * answered the request, or neither.
 */
const runHandler = (handler: RouteHandler): Promise<'next' | 'responded' | 'swallowed'> =>
  new Promise((resolve) => {
    let settled = false;
    const settle = (outcome: 'next' | 'responded' | 'swallowed') => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    const req = makeReq();
    const res = makeRes(() => settle('responded'));
    const next = () => settle('next');

    try {
      const result = handler.handle(req, res, next);
      // Async middleware may settle on a later tick.
      Promise.resolve(result)
        .then(() => setTimeout(() => settle('swallowed'), 250))
        .catch(() => settle('responded')); // a throw reaches the error handler
    } catch {
      // A synchronous throw is surfaced by Express, not swallowed.
      settle('responded');
    }
  });

describe('route contract', () => {
  const handlers = collectHandlers();

  it('finds routes to check', () => {
    expect(handlers.length).toBeGreaterThan(100);
  });

  it('has no middleware that neither responds nor calls next()', async () => {
    // Only middleware positions are exercised. The terminal handler is the
    // controller: it is expected to answer, and reaching it would need a
    // database.
    const middleware = handlers.filter((h) => h.index < h.total - 1);

    const swallowed: string[] = [];

    for (const handler of middleware) {
      const outcome = await runHandler(handler);
      if (outcome === 'swallowed') {
        swallowed.push(
          `${handler.routerName} ${handler.method} ${handler.path} [handler ${handler.index + 1}/${handler.total}]`,
        );
      }
    }

    expect(swallowed).toEqual([]);
  }, 120000);
});
