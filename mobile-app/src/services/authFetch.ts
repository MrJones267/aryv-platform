/**
 * @fileoverview Network helper for auth requests, with a safe production fallback
 * @author Oabona-Majoko
 * @created 2026-07-20
 * @lastModified 2026-07-20
 */

import { getApiConfig } from '../config/api';
import logger from './LoggingService';

const log = logger.createLogger('authFetch');

/**
 * POST to an auth endpoint, falling back to the production API when the
 * primary host cannot be reached.
 *
 * Why this exists: in debug builds getApiConfig() points apiUrl at
 * http://10.0.2.2:3001 (the Android emulator's alias for the host machine).
 * On a physical device, or with no local backend running, that host is
 * unreachable and every auth call fails with "Network error" even though the
 * production API is healthy. getApiConfig() already publishes fallbackApiUrl
 * for exactly this case, but the auth calls used a bare fetch() and never
 * consulted it.
 *
 * Retry policy — deliberately narrow:
 *
 *   - We retry ONLY when the request never completed (DNS failure, connection
 *     refused, timeout). In that case the server processed nothing, so
 *     re-sending is safe.
 *   - We NEVER retry a completed HTTP response, including 5xx. A POST that
 *     reached the server may have taken effect before it errored; retrying
 *     against a different host could register the same user twice.
 *
 * The caller receives the Response for whichever host answered, so normal
 * error bodies (validation messages, "email already registered") survive
 * intact rather than being flattened into an HTTP status string.
 */
export async function authFetch(
  path: string,
  init: RequestInit,
  timeoutMs = 30000,
): Promise<Response> {
  const config = getApiConfig();
  const primary = config.apiUrl;
  const fallback = config.fallbackApiUrl;

  // De-duplicate: in production builds apiUrl and fallbackApiUrl are the same
  // host, and there is nothing to fall back to.
  const hosts = fallback && fallback !== primary ? [primary, fallback] : [primary];

  let lastError: unknown;

  for (let i = 0; i < hosts.length; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${hosts[i]}${path}`, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // A completed response — including 4xx/5xx — is the answer. Hand it back
      // rather than retrying, so we neither mask the server's message nor
      // risk re-submitting a request that may already have taken effect.
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      const isLast = i === hosts.length - 1;
      if (!isLast) {
        log.warn(`Primary auth host unreachable for ${path}, trying fallback`);
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Network error');
}

export default authFetch;
