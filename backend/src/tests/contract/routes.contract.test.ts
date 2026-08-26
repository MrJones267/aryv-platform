/**
 * @fileoverview Contract tests over the real router stack: every route
 *               resolves, answers, enforces auth, and validates without
 *               hanging.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 */

import request from 'supertest';
import type { Express } from 'express';
import { buildApp, authHeader, TEST_USER, MOUNTS } from './harness';
import User from '../../models/User';

/** Every registered route, discovered from the routers themselves. */
interface DiscoveredRoute {
  mount: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  /** Path with :params filled in, so it actually matches. */
  concrete: string;
}

const UUID = '33333333-3333-4333-8333-333333333333';

const concretise = (mount: string, routePath: string): string => {
  const filled = routePath
    .split('/')
    .map((segment) => (segment.startsWith(':') ? UUID : segment))
    .join('/');
  return `${mount}${filled}`.replace(/\/$/, '') || '/';
};

const discoverRoutes = (): DiscoveredRoute[] => {
  const routes: DiscoveredRoute[] = [];

  for (const { path: mount, module } of MOUNTS) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const router = require(module).default;
    for (const layer of (router.stack ?? []) as any[]) {
      if (!layer.route) continue;
      const routePath: string = layer.route.path;
      for (const method of Object.keys(layer.route.methods)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
        routes.push({
          mount,
          method: method as DiscoveredRoute['method'],
          path: routePath,
          concrete: concretise(mount, routePath),
        });
      }
    }
  }

  return routes;
};

describe('route contract', () => {
  let app: Express;
  let routes: DiscoveredRoute[];

  beforeAll(() => {
    app = buildApp();
    routes = discoverRoutes();
  });

  beforeEach(() => {
    // Authentication is the only data lookup these tests need to get past.
    // Faithful to Sequelize: findByPk(undefined) short-circuits to null.
    jest.spyOn(User, 'findByPk').mockImplementation((async (pk: unknown) =>
      pk === TEST_USER.id
        ? { ...TEST_USER, toSafeObject: () => TEST_USER }
        : null) as any);
  });

  it('discovers the full route surface', () => {
    expect(routes.length).toBeGreaterThan(100);
  });

  /** Issue requests in bounded batches; ~130 routes sequentially is needlessly slow. */
  const inBatches = async <T, R>(
    items: T[],
    size: number,
    fn: (item: T) => Promise<R>,
  ): Promise<R[]> => {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += size) {
      results.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
    }
    return results;
  };

  describe('every route answers', () => {
    it('answers each route without hanging, and resolves it to a handler', async () => {
      // Two regressions in one pass, because both need the same request.
      //
      // Hanging: validateInput neither responded nor called next(), so the
      // request stopped mid-chain and the client waited for its own timeout.
      // A hang surfaces here as a supertest timeout.
      //
      // Missing: the mobile app called verification and OTP paths the server
      // never served. Those fall through to the 404 handler.
      const problems: string[] = [];

      await inBatches(routes, 16, async (route) => {
        const label = `${route.method.toUpperCase()} ${route.concrete}`;
        try {
          const res = await request(app)
            [route.method](route.concrete)
            .set(authHeader())
            .send({})
            .timeout({ deadline: 8000 });

          if (res.status === 404 && res.body?.code === 'ROUTE_NOT_FOUND') {
            problems.push(`${label} — fell through to the 404 handler`);
          }
        } catch (error) {
          const message = (error as Error).message ?? '';
          // A timeout is the failure this test exists for. A 500 from the
          // absent database still means the chain completed, which is the
          // property being asserted.
          if (/timeout|ECONNABORTED|socket hang up/i.test(message)) {
            problems.push(`${label} — no response: ${message}`);
          }
        }
      });

      expect(problems).toEqual([]);
    }, 180000);
  });

  describe('authentication is enforced', () => {
    /**
     * Routes that deliberately serve an unauthenticated caller. Anything not
     * listed here must refuse one — so adding a new public route fails this
     * test until somebody states the intent on purpose.
     */
    const DELIBERATELY_PUBLIC = [
      // Sign-up, sign-in, token refresh, password reset, OTP: all necessarily
      // reachable without a token.
      /^\/api\/auth\//,
      // Admin sign-in, necessarily reachable without an admin token.
      /^\/api\/admin\/auth\/login$/,
      // Stripe calls this; it authenticates by signature, not by bearer token.
      /^\/api\/bookings\/stripe-webhook$/,
      // Reference data with nothing user-specific in it.
      /^\/api\/countries/,
      /^\/api\/currencies/,
      /^\/api\/courier\/delivery-tiers/,
      /^\/api\/promos\/validate/,
      // Ride detail and public profile back share links: a ride can be shared
      // with someone who has no account. Both return a deliberately narrow
      // field set — getUserById exposes name, photo and rating, not contact
      // details. Flagged rather than assumed: if sharing is not meant to work
      // for signed-out recipients, these should move behind auth.
      /^\/api\/rides\/[0-9a-f-]{36}$/,
      /^\/api\/users\/[0-9a-f-]{36}$/,
    ];

    const isPublic = (concrete: string): boolean =>
      DELIBERATELY_PUBLIC.some((pattern) => pattern.test(concrete));

    it('never reaches a handler without an identity, except on declared public routes', async () => {
      const protectedRoutes = routes.filter((r) => !isPublic(r.concrete));

      const reached = (
        await inBatches(protectedRoutes, 16, async (route) => {
          const label = `${route.method.toUpperCase()} ${route.concrete}`;
          try {
            const res = await request(app)
              [route.method](route.concrete)
              .send({})
              .timeout({ deadline: 8000 });

            // 401 is the direct refusal. 429 means a rate limiter refused
            // first. 400 means validation rejected the request before auth ran
            // — the ordering is untidy, but the handler was still never
            // reached, which is the property that matters here.
            const refused = [400, 401, 429].includes(res.status);
            return refused ? null : `${label} → ${res.status}`;
          } catch (error) {
            return `${label} → no response: ${(error as Error).message}`;
          }
        })
      ).filter(Boolean);

      expect(reached).toEqual([]);
    }, 180000);

    it('rejects a token signed with the wrong secret', async () => {
      const jwt = require('jsonwebtoken');
      const forged = jwt.sign({ userId: TEST_USER.id }, 'not-the-real-secret');

      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${forged}`);

      expect(res.status).toBe(401);
    });

    it('rejects a token whose user no longer exists', async () => {
      jest.spyOn(User, 'findByPk').mockImplementation((async () => null) as any);

      const res = await request(app).get('/api/users/profile').set(authHeader());

      expect(res.status).toBe(401);
    });
  });

  describe('validation answers instead of stalling', () => {
    it('returns 400 with field detail for a malformed body', async () => {
      const res = await request(app)
        .post('/api/payments/cash/create')
        .set(authHeader())
        .send({ bookingId: 'not-a-uuid' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('returns 400 for a malformed path parameter', async () => {
      const res = await request(app)
        .get('/api/verification/status/not-a-uuid')
        .set(authHeader());

      expect(res.status).toBe(400);
    });

    it('lets a well-formed request past validation into the handler', async () => {
      // With no database the handler fails, and that is fine: the point is
      // that the request got *through* the chain rather than stopping in it.
      const res = await request(app)
        .get(`/api/verification/status/${TEST_USER.id}`)
        .set(authHeader());

      expect(res.status).not.toBe(400);
      expect(res.status).not.toBe(404);
    });
  });
});

/**
 * The harness must mount exactly what index.ts mounts.
 *
 * It did not: `/api/emergency` and `/api/calls` were live in production but
 * absent here, so every SOS and calling endpoint looked missing to the
 * path-contract test, and those false negatives were absorbed into its
 * KNOWN_GAPS list as though the features had never been built. A test that
 * silently stops covering a subsystem is worse than no test, so the drift
 * itself is now what fails.
 */
describe('harness mounts match the application', () => {
  it('mounts every router index.ts mounts, and no others', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path') as typeof import('path');

    const indexSource = fs.readFileSync(
      path.join(__dirname, '..', '..', 'index.ts'),
      'utf8',
    );

    const mountedInIndex = [
      ...indexSource.matchAll(/app\.use\('(\/api\/[a-z-]+(?:\/[a-z-]+)?)'/g),
    ]
      .map((match) => match[1] as string)
      .sort();

    const mountedInHarness = MOUNTS.map((mount) => mount.path).sort();

    expect(mountedInHarness).toEqual(mountedInIndex);
  });
});
