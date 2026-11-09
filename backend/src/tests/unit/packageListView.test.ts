/**
 * @fileoverview The courier's available list: names the app reads, numbers
 *               as numbers, and no contact details for browsing couriers
 * @author Oabona-Majoko
 * @created 2026-11-09
 * @lastModified 2026-11-09
 */

import { columnsOf, toPackageListView } from '../../utils/packageListView';

// The shape of Package.rawAttributes for the columns involved.
const columns = columnsOf({
  id: { field: 'id', type: { key: 'UUID' } },
  title: { field: 'title', type: { key: 'STRING' } },
  packageSize: { field: 'package_size', type: { key: 'ENUM' } },
  pickupAddress: { field: 'pickup_address', type: { key: 'TEXT' } },
  dropoffAddress: { field: 'dropoff_address', type: { key: 'TEXT' } },
  pickupContactPhone: { field: 'pickup_contact_phone', type: { key: 'STRING' } },
  dropoffContactName: { field: 'dropoff_contact_name', type: { key: 'STRING' } },
  pickupCoordinates: { field: 'pickup_coordinates', type: { key: 'GEOMETRY' } },
  distance: { type: { key: 'DECIMAL' } },
  senderPriceOffer: { field: 'sender_price_offer', type: { key: 'DECIMAL' } },
  fragile: { type: { key: 'BOOLEAN' } },
});

// As pg returns a row of `SELECT p.*, u.first_name as sender_first_name, ...`
const row = {
  id: 'p1',
  title: 'Shoes',
  package_size: 'small',
  pickup_address: 'Game City, Gaborone',
  dropoff_address: 'Main Mall, Francistown',
  pickup_contact_phone: '+26771234567',
  dropoff_contact_name: 'Neo',
  pickup_coordinates: '0101000020E6100000',
  distance: '432.50',
  sender_price_offer: '120.00',
  fragile: true,
  sender_first_name: 'Kago',
  sender_last_name: 'Molefe',
  sender_phone: '+26772000111',
  distance_from_courier: '3.2',
};

describe('toPackageListView', () => {
  const view = toPackageListView(row, columns);

  it('gives the pickup and drop-off under the names the app reads', () => {
    expect(view['pickupAddress']).toBe('Game City, Gaborone');
    expect(view['dropoffAddress']).toBe('Main Mall, Francistown');
    expect(view['packageSize']).toBe('small');
  });

  it('turns decimals back into numbers', () => {
    expect(view['senderPriceOffer']).toBe(120);
    expect(view['distance']).toBe(432.5);
    expect(view['distanceFromCourier']).toBe(3.2);
  });

  it('withholds contacts, the sender\'s phone and raw coordinates', () => {
    for (const key of ['pickupContactPhone', 'dropoffContactName', 'pickupCoordinates', 'pickup_contact_phone', 'sender_phone']) {
      expect(view).not.toHaveProperty(key);
    }
    expect(JSON.stringify(view)).not.toContain('+267');
  });

  it('names the sender by first name and initial only', () => {
    expect(view['sender']).toEqual({ firstName: 'Kago', lastName: 'M' });
  });

  it('keeps no snake_case column names', () => {
    expect(Object.keys(view).some((k) => k.includes('_'))).toBe(false);
  });
});
