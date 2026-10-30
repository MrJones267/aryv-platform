/**
 * @fileoverview What a push carries so the app can open the right screen
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 */

import { pushData } from '../../services/NotificationService';

describe('pushData', () => {
  const base = { type: 'ride_request_match', title: 't', message: 'm', timestamp: '2026-10-30T10:00:00.000Z' };

  it('sends the ids along with the type, as strings', () => {
    expect(pushData({ ...base, data: { rideId: 'r1', requestId: 'q1', seats: 2, urgent: true } })).toEqual({
      type: 'ride_request_match', timestamp: base.timestamp, rideId: 'r1', requestId: 'q1', seats: '2', urgent: 'true',
    });
  });

  it('takes the id from a nested booking or ride instead of the whole object', () => {
    const out = pushData({ ...base, type: 'booking_status_change', data: { bookingId: 'b1', booking: { id: 'b1', rideId: 'r9', notes: 'x' } } });
    expect(out).toEqual({ type: 'booking_status_change', timestamp: base.timestamp, bookingId: 'b1', rideId: 'r9' });
  });

  it('leaves out long or structured values', () => {
    const out = pushData({ ...base, data: { note: 'x'.repeat(500), list: [1, 2], nested: { a: 1 } } });
    expect(Object.keys(out).sort()).toEqual(['timestamp', 'type']);
  });

  it('copes with no data at all', () => {
    expect(pushData(base)).toEqual({ type: 'ride_request_match', timestamp: base.timestamp });
  });
});
