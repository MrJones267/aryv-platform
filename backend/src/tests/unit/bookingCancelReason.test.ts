/**
 * @fileoverview The booking model's rules for cancelling and rating
 * @author Oabona-Majoko
 * @created 2026-11-10
 * @lastModified 2026-11-10
 *
 * Uses the real model. The controllers' own tests mock it, which is how a
 * cancellation without a reason passed them while failing every real request:
 * completing a ride and rejecting a booking both answered 500.
 */

import fs from 'fs';
import path from 'path';
import Booking from '../../models/Booking';

/** Validate as Model.update does: only the fields being written. */
const validateUpdate = async (values: Record<string, unknown>): Promise<void> => {
  const all = Object.keys((Booking as any).rawAttributes);
  await (Booking as any).build(values).validate({ skip: all.filter((a) => !(a in values)) });
};

describe('booking model rules', () => {
  it('refuses a cancellation without a reason', async () => {
    await expect(validateUpdate({ status: 'cancelled' })).rejects.toThrow(/Cancel reason is required/);
  });

  it('accepts a cancellation with a reason', async () => {
    await expect(validateUpdate({ status: 'cancelled', cancelReason: 'Declined by the driver' })).resolves.toBeUndefined();
  });

  it('accepts a rating with no review', async () => {
    await expect(validateUpdate({ status: 'completed', ratingGiven: 4 })).resolves.toBeUndefined();
  });

  it('every booking cancellation in the server names a reason', () => {
    const root = path.join(__dirname, '..', '..');
    const offenders: string[] = [];
    for (const dir of ['controllers', 'services', 'routes']) {
      for (const file of fs.readdirSync(path.join(root, dir))) {
        const source = fs.readFileSync(path.join(root, dir, file), 'utf8');
        const writes = source.match(/\{\s*status: BookingStatus\.CANCELLED\s*\}/g) ?? [];
        // A bare { status: BookingStatus.CANCELLED } is a write with no reason;
        // filters and comparisons are written differently.
        if (writes.length > 0 && /update\(\s*\{\s*status: BookingStatus\.CANCELLED\s*\}/.test(source)) {
          offenders.push(`${dir}/${file}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
