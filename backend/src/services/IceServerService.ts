/**
 * @fileoverview ICE server configuration for WebRTC calls, including TURN.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * Calls were configured with Google's public STUN servers and a commented-out
 * line reading `turn:your-turn-server.com`. STUN alone only works when both
 * peers can be reached directly once their public address is discovered. On
 * mobile networks — where carrier-grade NAT is the norm, and symmetric NAT is
 * common — that frequently fails, and the call simply never connects. TURN is
 * what makes the difference, because it relays the media rather than trying to
 * hole-punch through.
 *
 * Credentials are issued here rather than shipped in the app. A TURN secret
 * baked into a mobile binary is extractable by anyone who downloads it, and a
 * relay is metered bandwidth someone else can then spend. This uses coturn's
 * standard `use-auth-secret` scheme: the username is an expiry timestamp, the
 * password is an HMAC of it under a secret only the server holds. Credentials
 * are valid for a few hours, so a leaked pair is worth little and rotation
 * needs no app release.
 */

import crypto from 'crypto';
import { logWarning } from '../utils/logger';

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceConfiguration {
  iceServers: IceServer[];
  /** False when no TURN is configured, so callers can warn rather than guess. */
  turnConfigured: boolean;
  /** Seconds until the TURN credentials stop working. */
  ttlSeconds: number;
}

/**
 * Public STUN, always included.
 *
 * These cost nothing and resolve the majority of connections on their own.
 * TURN is the fallback for the ones they cannot.
 */
const STUN_SERVERS: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/**
 * Four hours. Long enough that no call outlives its credentials — including a
 * call placed just before the app fetched them — and short enough that a
 * leaked pair expires on its own.
 */
export const TURN_CREDENTIAL_TTL_SECONDS = 4 * 60 * 60;

const TURN_URLS = (process.env['TURN_URLS'] || '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

const TURN_SECRET = process.env['TURN_SECRET'] || '';

/** Static credentials, for a TURN server not using the shared-secret scheme. */
const TURN_USERNAME = process.env['TURN_USERNAME'] || '';
const TURN_PASSWORD = process.env['TURN_PASSWORD'] || '';

export const isTurnConfigured = (): boolean =>
  TURN_URLS.length > 0 && Boolean(TURN_SECRET || (TURN_USERNAME && TURN_PASSWORD));

export class IceServerService {
  /**
   * ICE servers for one user.
   *
   * The user id is embedded in the TURN username so relay usage can be traced
   * back to an account if someone abuses it.
   */
  getConfiguration(userId: string): IceConfiguration {
    const iceServers: IceServer[] = [...STUN_SERVERS];

    if (TURN_URLS.length === 0) {
      return { iceServers, turnConfigured: false, ttlSeconds: 0 };
    }

    if (TURN_SECRET) {
      const { username, credential } = this.mintCredentials(userId);
      iceServers.push({ urls: TURN_URLS, username, credential });
      return {
        iceServers,
        turnConfigured: true,
        ttlSeconds: TURN_CREDENTIAL_TTL_SECONDS,
      };
    }

    if (TURN_USERNAME && TURN_PASSWORD) {
      iceServers.push({
        urls: TURN_URLS,
        username: TURN_USERNAME,
        credential: TURN_PASSWORD,
      });
      // Static credentials never expire, which is why the secret scheme is
      // preferred; reported as 0 so clients do not schedule a refresh.
      return { iceServers, turnConfigured: true, ttlSeconds: 0 };
    }

    // URLs without any credentials: the relay will refuse us. Say so rather
    // than handing back a config that looks complete.
    logWarning('TURN URLs are set but no credentials are configured', {
      urlCount: TURN_URLS.length,
    });

    return { iceServers, turnConfigured: false, ttlSeconds: 0 };
  }

  /**
   * coturn's `use-auth-secret` scheme.
   *
   * username = "<unix-expiry>:<userId>", credential = base64(HMAC-SHA1(secret,
   * username)). The TURN server recomputes the HMAC from the username it is
   * given, so nothing has to be shared or stored between the two.
   */
  private mintCredentials(userId: string): { username: string; credential: string } {
    const expiry = Math.floor(Date.now() / 1000) + TURN_CREDENTIAL_TTL_SECONDS;
    const username = `${expiry}:${userId}`;

    const credential = crypto
      .createHmac('sha1', TURN_SECRET)
      .update(username)
      .digest('base64');

    return { username, credential };
  }
}

export const iceServerService = new IceServerService();
export default iceServerService;
