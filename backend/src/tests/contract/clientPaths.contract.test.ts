/**
 * @fileoverview Checks that every API path the mobile app calls is actually
 *               served by the backend.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * Two shipped defects would have been caught here on the day they were
 * written. OTPService posted to /otp/sms/send when the route is
 * /auth/otp/sms/send, and DocumentVerificationService called /verification/*
 * routes that did not exist at all. Both were invisible in development because
 * the client short-circuited to mocks behind __DEV__, and invisible to the
 * backend tests because nothing compared the two sides.
 *
 * The client's paths are read from its source rather than duplicated here, so
 * this cannot drift: renaming a route on either side fails the test.
 */

import fs from 'fs';
import path from 'path';
import { MOUNTS } from './harness';

const MOBILE_SERVICES = path.resolve(__dirname, '../../../../mobile-app/src/services');

/** Client call sites: `.get('/x')`, `.post(`/x/${id}`)`, and so on. */
const CALL_PATTERN =
  /\.(get|post|put|patch|delete)\s*\(\s*['"`](\/[^'"`\s)]*)/g;

/**
 * Paths that are not backend API calls. The scan is deliberately broad, so
 * anything matching the shape but not aimed at this API is excluded here.
 */
const NOT_API_CALLS = [
  /^\/uploads\//, // static file paths, served outside the /api prefix
  /^\/\//, // protocol-relative URLs
];

interface ClientCall {
  file: string;
  method: string;
  rawPath: string;
  /** Resolved server path, with template holes filled. */
  resolved: string;
}

const listFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      out.push(...listFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
};

const collectClientCalls = (): ClientCall[] => {
  const calls: ClientCall[] = [];

  for (const file of listFiles(MOBILE_SERVICES)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(CALL_PATTERN)) {
      const method = match[1]!;
      const rawPath = match[2]!;

      if (NOT_API_CALLS.some((p) => p.test(rawPath))) continue;

      // `${...}` interpolations stand in for path parameters; the query
      // string is not part of the route.
      const resolved = `/api${rawPath
        .replace(/\$\{[^}]*\}/g, ':param')
        .split('?')[0]!
        .replace(/\/$/, '')}`;

      calls.push({
        file: path.relative(MOBILE_SERVICES, file),
        method,
        rawPath,
        resolved,
      });
    }
  }

  return calls;
};

/** Server routes as matchers, from the routers themselves. */
const collectServerRoutes = (): Array<{ method: string; regex: RegExp; label: string }> => {
  const routes: Array<{ method: string; regex: RegExp; label: string }> = [];

  for (const { path: mount, module } of MOUNTS) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const router = require(module).default;
    for (const layer of (router.stack ?? []) as any[]) {
      if (!layer.route) continue;
      const full = `${mount}${layer.route.path}`.replace(/\/$/, '');
      const pattern = `^${full.replace(/:[^/]+/g, '[^/]+')}$`;
      for (const method of Object.keys(layer.route.methods)) {
        routes.push({
          method,
          regex: new RegExp(pattern),
          label: `${method.toUpperCase()} ${full}`,
        });
      }
    }
  }

  return routes;
};

describe('mobile client / backend path contract', () => {
  const calls = collectClientCalls();
  const serverRoutes = collectServerRoutes();

  it('finds client call sites to check', () => {
    // Guards the scan itself: if the regex or the directory layout changes so
    // that nothing is found, this suite would otherwise pass vacuously.
    expect(calls.length).toBeGreaterThan(30);
  });

  /**
   * Client calls with no matching server route, as of 23 August 2026.
   *
   * This is a ratchet, not an allowlist. The assertion is equality, so the
   * list can only be changed deliberately: a new mismatch fails the test, and
   * so does fixing one without deleting the line. It should only ever shrink.
   *
   * These are not near-misses. They are mostly whole features whose mobile
   * service layer was written against an API that does not exist, which is why
   * they are recorded rather than patched — renaming paths would not make them
   * work.
   */
  const KNOWN_GAPS: string[] = [
    // Escrow payments. EscrowPaymentService drives an entire payment
    // flow with no server side at all — see the courier findings: the escrow
    // provider itself is a mock. These cannot be fixed by renaming a path.
    'GET /api/payments/escrow/:param  (EscrowPaymentService.ts)',
    'GET /api/payments/escrow/:param/auto-release-check  (EscrowPaymentService.ts)',
    'GET /api/payments/escrow/history  (EscrowPaymentService.ts)',
    'GET /api/payments/escrow/ride/:param  (EscrowPaymentService.ts)',
    'GET /api/payments/escrow/statistics  (EscrowPaymentService.ts)',
    'GET /api/payments/escrow/wallet/balance  (EscrowPaymentService.ts)',
    'POST /api/payments/escrow/:param/dispute  (EscrowPaymentService.ts)',
    'POST /api/payments/escrow/:param/fund  (EscrowPaymentService.ts)',
    'POST /api/payments/escrow/:param/refund  (EscrowPaymentService.ts)',
    'POST /api/payments/escrow/:param/release  (EscrowPaymentService.ts)',
    'POST /api/payments/escrow/create  (EscrowPaymentService.ts)',
    'POST /api/payments/escrow/eligibility-check  (EscrowPaymentService.ts)',

    // Courier. Some are genuine shape mismatches against routes that do
    // exist (the server has /packages/available, the client asks for
    // /available/packages); others have no route. Left until the courier
    // delivery-confirmation design is settled, since the client will change.
    'GET /api/courier/available/packages  (PackageService.ts)',
    'GET /api/courier/deliveries/available  (CourierService.ts)',
    'GET /api/courier/notifications  (CourierService.ts)',
    'GET /api/courier/packages/:param  (PackageService.ts)',
    'GET /api/courier/stats  (CourierService.ts)',
    'GET /api/courier/user/packages  (PackageService.ts)',
    'POST /api/courier/availability  (CourierService.ts)',
    'POST /api/courier/deliveries/accept  (CourierService.ts)',
    'POST /api/courier/location  (CourierService.ts)',
    'PUT /api/courier/deliveries/:param/status  (CourierService.ts)',
    'PUT /api/courier/notifications/:param  (CourierService.ts)',

    // Emergency / SOS. No router is mounted for any of this. Note the
    // singular /user/ prefix, which does not match the /users router either.
    'DELETE /api/user/emergency-contacts/:param  (EmergencyService.ts)',
    'GET /api/user/emergency-contacts  (EmergencyService.ts)',
    'POST /api/emergency/alerts  (EmergencyService.ts)',
    'POST /api/emergency/contacts/find  (CallIntegrationService.ts)',
    'POST /api/user/emergency-contacts  (EmergencyService.ts)',
    'PUT /api/emergency/alerts/:param  (EmergencyService.ts)',
    'PUT /api/emergency/alerts/:param/location  (EmergencyService.ts)',

    // Voice and video calling. Call models and a CallService exist on the
    // server, but no HTTP routes are mounted for them.
    'GET /api/calls/history  (CallService.ts)',
    'GET /api/calls/history/:param/:param  (CallIntegrationService.ts)',
    'POST /api/calls/workflows/create  (CallIntegrationService.ts)',
    'POST /api/calls/workflows/emergency  (CallIntegrationService.ts)',
    'PUT /api/calls/:param/quality  (CallService.ts)',
    'PUT /api/calls/workflows/:param/status  (CallIntegrationService.ts)',

    // AI matching, pricing and recommendations. No routes; the mobile
    // services call an API that was never built.
    'GET /api/pricing/history:param  (AIPricingService.ts)',
    'GET /api/pricing/surge-zones  (AIPricingService.ts)',
    'POST /api/ai/matching/find  (AIMatchingService.ts)',
    'POST /api/ai/pricing/calculate  (AIPricingService.ts)',
    'POST /api/ai/recommendations/generate  (AIRecommendationsService.ts)',
    'POST /api/ai/recommendations/profile  (AIRecommendationsService.ts)',
    'POST /api/drivers/available  (AIMatchingService.ts)',
    'POST /api/pricing/feedback  (AIPricingService.ts)',

    // Notification preferences and token registration.
    'GET /api/notifications/preferences  (NotificationService.ts)',
    'POST /api/notifications/register-token  (NotificationService.ts)',
    'PUT /api/notifications/preferences  (NotificationService.ts)',

    // Assorted single endpoints.
    'GET /api/currencies/country/:param  (CurrencyService.ts)',
    'POST /api/locations/emergency  (EmergencyServiceSimple.ts)',
    'POST /api/users/currency  (CurrencyService.ts)',
    'PUT /api/countries/user  (CountryService.ts)',
  ];

  it('has no client path missing from the server beyond the recorded gaps', () => {
    const unmatched = [
      ...new Set(
        calls
          .filter(
            (call) =>
              !serverRoutes.some(
                (route) =>
                  route.method === call.method && route.regex.test(call.resolved),
              ),
          )
          .map((call) => `${call.method.toUpperCase()} ${call.resolved}  (${call.file})`),
      ),
    ].sort();

    // Sorted for comparison; KNOWN_GAPS stays grouped by feature to read.
    expect(unmatched).toEqual([...KNOWN_GAPS].sort());
  });

  it('records only genuine gaps', () => {
    // Guards the ratchet itself: an entry that no longer corresponds to a real
    // client call is stale and should be removed.
    const everyCall = new Set(
      calls.map((call) => `${call.method.toUpperCase()} ${call.resolved}  (${call.file})`),
    );
    const stale = KNOWN_GAPS.filter((gap) => !everyCall.has(gap));

    expect(stale).toEqual([]);
  });
});
