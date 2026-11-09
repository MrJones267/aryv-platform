/**
 * @fileoverview How long a package stays open for couriers
 * @author Oabona-Majoko
 * @created 2026-11-09
 * @lastModified 2026-11-09
 *
 * Every courier list filtered on expires_at, but nothing ever set it, so a
 * package stayed up for couriers for ever, long after the delivery it asked
 * for was due. A package now closes a day after its requested delivery time,
 * or a week after posting when it named none. The sender can post it again.
 */

const HOUR = 60 * 60 * 1000;

/** With no requested time: how long a package waits for a courier. */
export const OPEN_FOR_MS = 7 * 24 * HOUR;
/** After the requested time: how long it stays up, as couriers may still take it. */
export const GRACE_AFTER_REQUESTED_MS = 24 * HOUR;

/**
 * When a package posted now should stop being offered to couriers.
 *
 * @param requestedDeliveryTime - When the sender wants it delivered, if they said
 * @param now - For tests
 */
export const packageExpiry = (requestedDeliveryTime?: Date | string | null, now: Date = new Date()): Date => {
  const requested = requestedDeliveryTime ? new Date(requestedDeliveryTime) : null;
  if (requested && !Number.isNaN(requested.getTime())) {
    // Never sooner than the grace period from now, even for a time already past.
    return new Date(Math.max(requested.getTime(), now.getTime()) + GRACE_AFTER_REQUESTED_MS);
  }
  return new Date(now.getTime() + OPEN_FOR_MS);
};

/** Whether a package's offer to couriers has run out. */
export const isPackageExpired = (expiresAt: Date | string | null | undefined, now: Date = new Date()): boolean =>
  expiresAt != null && new Date(expiresAt).getTime() <= now.getTime();
